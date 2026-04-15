/**
 * ADB 客户端 - 高层 API
 * 
 * 关键设计：
 * 1. ADB 是单通道多路复用协议，所有流共享同一个 USB 通道
 * 2. 使用操作锁确保同一时间只有一个 ADB 命令在执行
 * 3. 后台接收循环按 localId 分发消息
 */

import { AdbProtocol } from './adb-protocol.js';
import { AdbTransport } from './adb-transport.js';
import { AdbKeyStore } from './adb-crypto.js';

export class AdbClient {
  constructor() {
    this.transport = new AdbTransport();
    this.keyStore = new AdbKeyStore();
    this.connected = false;
    this.deviceInfo = '';
    this.localIdCounter = 1;
    this.onLog = null;
    // 操作锁：确保同一时间只有一个 ADB 操作
    this._busy = false;
    this._queue = [];
  }

  log(msg) {
    console.log('[ADB]', msg);
    if (this.onLog) this.onLog(msg);
  }

  /**
   * 获取操作锁
   */
  async _acquireLock() {
    if (!this._busy) {
      this._busy = true;
      return;
    }
    // 等待锁释放
    return new Promise(resolve => {
      this._queue.push(resolve);
    });
  }

  /**
   * 释放操作锁
   */
  _releaseLock() {
    if (this._queue.length > 0) {
      const next = this._queue.shift();
      next();
    } else {
      this._busy = false;
    }
  }

  /**
   * 连接设备并完成认证
   */
  async connect() {
    this.log('步骤1: 打开 USB 设备...');
    try {
      await this.transport.open();
      this.log('USB 设备已打开: ' + this.transport.getDeviceName());
    } catch (e) {
      this.log('❌ USB 设备打开失败: ' + e.message);
      throw e;
    }

    this.log('步骤2: 发送 CNXN 消息...');
    try {
      const cnxnMsg = AdbProtocol.connect();
      this.log(`CNXN 消息: header=${cnxnMsg.header.length}字节, data=${cnxnMsg.data.length}字节`);
      await this.transport.send(cnxnMsg);
      this.log('CNXN 消息已发送');
    } catch (e) {
      this.log('❌ 发送 CNXN 失败: ' + e.message);
      throw e;
    }

    this.log('步骤3: 等待设备响应...');
    let triedSignature = false;

    for (let attempt = 0; attempt < 30; attempt++) {
      let msg;
      try {
        msg = await this.transport.receive(30000);
      } catch (e) {
        this.log('❌ 接收消息失败: ' + e.message);
        throw e;
      }

      const cmdNames = { 0x4e584e43: 'CNXN', 0x48545541: 'AUTH', 0x4e45504f: 'OPEN', 0x59414b4f: 'OKAY', 0x45534c43: 'CLSE', 0x45545257: 'WRTE' };
      const cmdName = cmdNames[msg.command] || `未知(0x${msg.command.toString(16)})`;
      this.log(`收到: ${cmdName} arg0=${msg.arg0} arg1=${msg.arg1} dataLen=${msg.dataLength}`);

      // 忽略旧流的 CLSE 消息
      if (msg.command === AdbProtocol.COMMANDS.CLSE) continue;

      if (msg.command === AdbProtocol.COMMANDS.CNXN) {
        this.deviceInfo = new TextDecoder().decode(msg.data).replace(/\0/g, '');
        this.connected = true;
        this.log('✅ 连接成功: ' + this.deviceInfo);
        return this.deviceInfo;
      }

      if (msg.command === AdbProtocol.COMMANDS.AUTH) {
        if (msg.arg0 === AdbProtocol.AUTH_TOKEN) {
          if (!triedSignature) {
            triedSignature = true;
            this.log('收到 AUTH TOKEN，尝试签名...');
            try {
              const signature = await this.keyStore.sign(msg.data);
              await this.transport.send(AdbProtocol.authSignature(new Uint8Array(signature)));
              this.log('签名已发送');
              continue;
            } catch (e) {
              this.log('签名失败: ' + e.message);
            }
          }
          this.log('发送公钥请求授权...');
          try {
            const pubKey = await this.keyStore.getPublicKeyPayload();
            this.log(`公钥 payload: ${pubKey.length} 字节`);
            await this.transport.send(AdbProtocol.authPublicKey(pubKey));
            this.log('公钥已发送，请在手机上点击"允许 USB 调试"');
          } catch (e) {
            this.log('❌ 发送公钥失败: ' + e.message);
            throw e;
          }
        }
      }
    }

    throw new Error('认证失败：超过最大尝试次数');
  }

  /**
   * 执行一个完整的 ADB 流操作（带锁）
   * 打开流 -> 读取所有数据 -> 关闭流
   */
  async _execStream(destination, timeoutMs = 15000) {
    await this._acquireLock();
    try {
      const localId = this.localIdCounter++;

      // 发送 OPEN
      await this.transport.send(AdbProtocol.open(localId, destination));

      // 等待 OKAY
      let remoteId = 0;
      const chunks = [];

      while (true) {
        const msg = await this.transport.receive(timeoutMs);

        if (msg.command === AdbProtocol.COMMANDS.OKAY) {
          remoteId = msg.arg0;
        } else if (msg.command === AdbProtocol.COMMANDS.WRTE) {
          chunks.push(msg.data);
          await this.transport.send(AdbProtocol.okay(localId, remoteId));
        } else if (msg.command === AdbProtocol.COMMANDS.CLSE) {
          // 流结束
          break;
        } else {
          // 忽略其他消息（如旧流的 CLSE）
          console.log('[ADB] 忽略消息: 0x' + msg.command.toString(16) + ' arg1=' + msg.arg1);
        }
      }

      // 合并数据
      const totalLen = chunks.reduce((s, c) => s + c.length, 0);
      const result = new Uint8Array(totalLen);
      let offset = 0;
      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }
      return result;
    } finally {
      this._releaseLock();
    }
  }

  /**
   * 执行 shell 命令并返回原始字节
   */
  async shell(command) {
    if (!this.connected) throw new Error('设备未连接');
    return await this._execStream('shell:' + command, 15000);
  }

  /**
   * 执行 shell 命令并返回文本
   */
  async shellText(command) {
    const result = await this.shell(command);
    return new TextDecoder().decode(result).trim();
  }

  /**
   * 截屏并返回 PNG 数据
   * 使用 exec: 协议，不会对二进制数据做 \r\n 转义
   */
  async screencap() {
    if (!this.connected) throw new Error('设备未连接');
    return await this._execStream('exec:screencap -p', 30000);
  }

  async tap(x, y) {
    await this.shellText(`input tap ${Math.round(x)} ${Math.round(y)}`);
  }

  async swipe(x1, y1, x2, y2, duration = 300) {
    await this.shellText(`input swipe ${Math.round(x1)} ${Math.round(y1)} ${Math.round(x2)} ${Math.round(y2)} ${duration}`);
  }

  async keyEvent(keyCode) {
    await this.shellText(`input keyevent ${keyCode}`);
  }

  /**
   * 获取设备基本信息（串行执行）
   */
  async getDeviceInfo() {
    const info = {};
    try { info.model = await this.shellText('getprop ro.product.model'); } catch(e) { info.model = '-'; }
    try { info.brand = await this.shellText('getprop ro.product.brand'); } catch(e) { info.brand = '-'; }
    try { info.version = await this.shellText('getprop ro.build.version.release'); } catch(e) { info.version = '-'; }
    try { info.sdk = await this.shellText('getprop ro.build.version.sdk'); } catch(e) { info.sdk = '-'; }
    try { info.resolution = await this.shellText('wm size'); } catch(e) { info.resolution = '-'; }
    try { info.battery = await this.shellText('dumpsys battery | grep level'); } catch(e) { info.battery = '-'; }
    return info;
  }

  async disconnect() {
    this.connected = false;
    this._busy = false;
    this._queue = [];
    await this.transport.close();
    this.log('已断开连接');
  }
}


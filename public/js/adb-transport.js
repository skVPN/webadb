/**
 * ADB USB 传输层
 * 通过 WebUSB API 与 Android 设备通信
 */

import { AdbProtocol } from './adb-protocol.js';

const ADB_CLASS = 0xFF;
const ADB_SUBCLASS = 0x42;
const ADB_PROTOCOL = 0x01;

function withTimeout(promise, ms, msg) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(msg)), ms))
  ]);
}

export class AdbTransport {
  constructor() {
    this.device = null;
    this.interfaceNumber = -1;
    this.endpointIn = null;
    this.endpointOut = null;
  }

  async open(existingDevice = null) {
    if (existingDevice) {
      this.device = existingDevice;
    } else {
      this.device = await navigator.usb.requestDevice({
        filters: [{ classCode: ADB_CLASS, subclassCode: ADB_SUBCLASS, protocolCode: ADB_PROTOCOL }]
      });
    }

    await this.device.open();
    console.log('[USB] 设备已打开:', this.device.productName);

    if (!this.device.configuration) {
      await this.device.selectConfiguration(1);
    }
    console.log('[USB] 配置:', this.device.configuration.configurationValue);

    const config = this.device.configuration;
    for (const iface of config.interfaces) {
      for (const alt of iface.alternates) {
        if (alt.interfaceClass === ADB_CLASS &&
            alt.interfaceSubclass === ADB_SUBCLASS &&
            alt.interfaceProtocol === ADB_PROTOCOL) {
          this.interfaceNumber = iface.interfaceNumber;
          for (const ep of alt.endpoints) {
            if (ep.direction === 'in') this.endpointIn = ep;
            if (ep.direction === 'out') this.endpointOut = ep;
          }
          break;
        }
      }
      if (this.interfaceNumber >= 0) break;
    }

    if (this.interfaceNumber < 0) {
      throw new Error('未找到 ADB 接口，请确认设备已开启 USB 调试');
    }

    console.log(`[USB] 接口: ${this.interfaceNumber}, IN: EP${this.endpointIn.endpointNumber}, OUT: EP${this.endpointOut.endpointNumber}`);
    console.log(`[USB] IN packetSize: ${this.endpointIn.packetSize}, OUT packetSize: ${this.endpointOut.packetSize}`);

    try {
      await this.device.claimInterface(this.interfaceNumber);
      console.log('[USB] 接口已声明');
    } catch (e) {
      throw new Error('无法声明 USB 接口，可能被其他程序占用（请先运行 adb kill-server）: ' + e.message);
    }
  }

  /**
   * 发送 ADB 消息
   */
  async send(message) {
    const headerResult = await withTimeout(
      this.device.transferOut(this.endpointOut.endpointNumber, message.header),
      5000,
      'USB 发送超时，可能 ADB server 正在占用设备'
    );
    if (headerResult.status !== 'ok') {
      throw new Error('发送头部失败: ' + headerResult.status);
    }

    if (message.data.length > 0) {
      const dataResult = await withTimeout(
        this.device.transferOut(this.endpointOut.endpointNumber, message.data),
        5000,
        'USB 发送数据超时'
      );
      if (dataResult.status !== 'ok') {
        throw new Error('发送数据失败: ' + dataResult.status);
      }
    }
  }

  /**
   * 接收 ADB 消息
   */
  async receive(timeoutMs = 60000) {
    const headerResult = await withTimeout(
      this.device.transferIn(this.endpointIn.endpointNumber, 24),
      timeoutMs,
      `USB 接收超时（${timeoutMs/1000}s），设备可能未响应`
    );

    if (headerResult.status !== 'ok') {
      throw new Error('USB 读取头部失败: ' + headerResult.status);
    }

    const headerBytes = new Uint8Array(headerResult.data.buffer);
    const header = AdbProtocol.parseHeader(headerBytes);

    let data = new Uint8Array(0);
    if (header.dataLength > 0) {
      const chunks = [];
      let received = 0;

      while (received < header.dataLength) {
        const remaining = header.dataLength - received;
        const readSize = Math.min(remaining, 16384);
        const result = await withTimeout(
          this.device.transferIn(this.endpointIn.endpointNumber, readSize),
          10000,
          'USB 读取数据超时'
        );

        if (result.status !== 'ok') {
          throw new Error('USB 读取数据失败: ' + result.status);
        }

        const chunk = new Uint8Array(result.data.buffer);
        chunks.push(chunk);
        received += chunk.length;
      }

      data = new Uint8Array(header.dataLength);
      let offset = 0;
      for (const chunk of chunks) {
        data.set(chunk, offset);
        offset += chunk.length;
      }
    }

    return { ...header, data };
  }

  async close() {
    if (this.device) {
      try {
        if (this.interfaceNumber >= 0) {
          await this.device.releaseInterface(this.interfaceNumber);
        }
        await this.device.close();
      } catch (e) {
        console.warn('[USB] 关闭设备时出错:', e);
      }
      this.device = null;
      this.interfaceNumber = -1;
    }
  }

  getDeviceName() {
    if (!this.device) return '未连接';
    return `${this.device.manufacturerName || ''} ${this.device.productName || ''} (${this.device.serialNumber || 'N/A'})`.trim();
  }
}

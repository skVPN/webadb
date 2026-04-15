/**
 * ADB 协议实现
 * 参考: https://android.googlesource.com/platform/system/core/+/master/adb/protocol.txt
 */

// ADB 协议常量
const ADB_COMMANDS = {
  CNXN: 0x4e584e43, // CONNECT
  AUTH: 0x48545541, // AUTH
  OPEN: 0x4e45504f, // OPEN
  OKAY: 0x59414b4f, // OKAY
  CLSE: 0x45534c43, // CLOSE
  WRTE: 0x45545257, // WRITE
};

const AUTH_TOKEN = 1;
const AUTH_SIGNATURE = 2;
const AUTH_RSAPUBLICKEY = 3;

const ADB_VERSION = 0x01000000;
const MAX_PAYLOAD = 1024 * 1024; // 1MB

export class AdbProtocol {
  /**
   * 构建 ADB 消息包
   */
  static buildMessage(command, arg0, arg1, data = null) {
    const dataBytes = data ? (typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data)) : new Uint8Array(0);
    const header = new ArrayBuffer(24);
    const view = new DataView(header);

    view.setUint32(0, command, true);
    view.setUint32(4, arg0, true);
    view.setUint32(8, arg1, true);
    view.setUint32(12, dataBytes.length, true);
    view.setUint32(16, AdbProtocol.checksum(dataBytes), true);
    view.setUint32(20, command ^ 0xFFFFFFFF, true);

    return { header: new Uint8Array(header), data: dataBytes };
  }

  /**
   * 解析 ADB 消息头
   */
  static parseHeader(buffer) {
    const view = new DataView(buffer.buffer || buffer);
    return {
      command: view.getUint32(0, true),
      arg0: view.getUint32(4, true),
      arg1: view.getUint32(8, true),
      dataLength: view.getUint32(12, true),
      dataChecksum: view.getUint32(16, true),
      magic: view.getUint32(20, true),
    };
  }

  /**
   * 计算数据校验和
   */
  static checksum(data) {
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum = (sum + data[i]) & 0xFFFFFFFF;
    }
    return sum;
  }

  /**
   * 构建 CONNECT 消息
   */
  static connect() {
    return AdbProtocol.buildMessage(
      ADB_COMMANDS.CNXN, ADB_VERSION, MAX_PAYLOAD,
      'host::features=shell_v2,cmd,stat_v2,ls_v2,fixed_push_mkdir,apex,abb,fixed_push_symlink_timestamp,abb_exec,remount_shell,track_app,sendrecv_v2,sendrecv_v2_brotli,sendrecv_v2_lz4,sendrecv_v2_zstd,sendrecv_v2_dry_run_send,openscreen_mdns\0'
    );
  }

  /**
   * 构建 AUTH 签名消息
   */
  static authSignature(signature) {
    return AdbProtocol.buildMessage(ADB_COMMANDS.AUTH, AUTH_SIGNATURE, 0, signature);
  }

  /**
   * 构建 AUTH 公钥消息
   */
  static authPublicKey(publicKey) {
    return AdbProtocol.buildMessage(ADB_COMMANDS.AUTH, AUTH_RSAPUBLICKEY, 0, publicKey);
  }

  /**
   * 构建 OPEN 消息（打开流）
   */
  static open(localId, destination) {
    return AdbProtocol.buildMessage(ADB_COMMANDS.OPEN, localId, 0, destination + '\0');
  }

  /**
   * 构建 WRITE 消息
   */
  static write(localId, remoteId, data) {
    return AdbProtocol.buildMessage(ADB_COMMANDS.WRTE, localId, remoteId, data);
  }

  /**
   * 构建 OKAY 消息
   */
  static okay(localId, remoteId) {
    return AdbProtocol.buildMessage(ADB_COMMANDS.OKAY, localId, remoteId);
  }

  /**
   * 构建 CLOSE 消息
   */
  static close(localId, remoteId) {
    return AdbProtocol.buildMessage(ADB_COMMANDS.CLSE, localId, remoteId);
  }

  static get COMMANDS() { return ADB_COMMANDS; }
  static get AUTH_TOKEN() { return AUTH_TOKEN; }
  static get AUTH_SIGNATURE() { return AUTH_SIGNATURE; }
  static get AUTH_RSAPUBLICKEY() { return AUTH_RSAPUBLICKEY; }
}

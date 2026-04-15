/**
 * 本地 HTTPS 服务器
 * 自动生成自签名证书，支持局域网 IP 访问
 * WebUSB 要求 Secure Context（HTTPS），所以必须用 HTTPS
 * 
 * 使用: node server.js
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const PORT_HTTPS = 8443;
const PORT_HTTP = 8080;
const PUBLIC_DIR = path.join(__dirname, 'public');
const CERT_DIR = path.join(__dirname, 'certs');

// MIME 类型映射
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

/**
 * 生成自签名证书（使用 Node.js 内置 crypto）
 */
function generateSelfSignedCert() {
  if (!fs.existsSync(CERT_DIR)) {
    fs.mkdirSync(CERT_DIR, { recursive: true });
  }

  const keyPath = path.join(CERT_DIR, 'key.pem');
  const certPath = path.join(CERT_DIR, 'cert.pem');

  // 如果证书已存在，直接使用
  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    console.log('📜 使用已有证书');
    return {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath),
    };
  }

  console.log('🔐 生成自签名证书...');

  // 获取本机所有 IP
  const ips = getLocalIPs();
  const altNames = ips.map((ip, i) => `IP.${i + 1} = ${ip}`).join('\n');

  // 使用 Node.js crypto 生成密钥对和自签名证书
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  // 使用 openssl 命令行生成证书（如果可用）
  // 否则使用简单的自签名方式
  try {
    const { execSync } = require('child_process');

    // 写入私钥
    fs.writeFileSync(keyPath, privateKey);

    // 创建 openssl 配置
    const opensslConf = path.join(CERT_DIR, 'openssl.cnf');
    fs.writeFileSync(opensslConf, `
[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn
x509_extensions = v3_req

[dn]
CN = WebADB Local Server

[v3_req]
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
${altNames}
`);

    // 生成自签名证书
    execSync(`openssl req -new -x509 -key "${keyPath}" -out "${certPath}" -days 365 -config "${opensslConf}"`, {
      stdio: 'pipe'
    });

    console.log('✅ 证书已生成（openssl）');
  } catch (e) {
    // openssl 不可用，用 Node.js 的 crypto 生成简单证书
    // Node 15+ 支持 X509Certificate，但我们用更兼容的方式
    console.log('⚠️ openssl 不可用，使用内置方式生成证书...');

    // 写入密钥
    fs.writeFileSync(keyPath, privateKey);

    // 使用 node 的 tls 模块创建自签名证书
    // 需要 node 15+ 的 generateCertificate 或者用第三方库
    // 这里用最简单的方式：直接用 node --experimental 生成
    try {
      const result = require('child_process').execSync(
        `node -e "
const { generateKeyPairSync, createSign, X509Certificate } = require('crypto');
// 简单方式：使用 node 的 tls.createSecureContext 不需要证书文件
// 但我们需要证书文件给 https.createServer
// 最简单的方案：提示用户用 Chrome flag
console.log('FALLBACK');
"`, { encoding: 'utf-8' }
      ).trim();

      if (result === 'FALLBACK') {
        // 无法生成证书，使用 HTTP + Chrome flag 方案
        fs.unlinkSync(keyPath);
        return null;
      }
    } catch (e2) {
      fs.unlinkSync(keyPath);
      return null;
    }
  }

  return {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath),
  };
}

/**
 * 获取本机所有局域网 IP
 */
function getLocalIPs() {
  const interfaces = os.networkInterfaces();
  const ips = ['127.0.0.1'];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  return ips;
}

/**
 * 处理 HTTP 请求
 */
function handleRequest(req, res) {
  let filePath = path.join(PUBLIC_DIR, req.url === '/' ? 'index.html' : req.url);

  // 安全检查：防止路径遍历
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404);
        res.end('Not Found');
      } else {
        res.writeHead(500);
        res.end('Internal Server Error');
      }
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

/**
 * 启动服务器
 */
function start() {
  const ips = getLocalIPs();

  console.log('');
  console.log('📱 WebADB Viewer 本地服务器');
  console.log('═══════════════════════════════');

  // 尝试启动 HTTPS
  const certs = generateSelfSignedCert();

  if (certs) {
    const httpsServer = https.createServer(certs, handleRequest);
    httpsServer.listen(PORT_HTTPS, '0.0.0.0', () => {
      console.log('');
      console.log('🔒 HTTPS 服务已启动（WebUSB 可用）:');
      ips.forEach(ip => {
        console.log(`   https://${ip}:${PORT_HTTPS}/`);
      });
      console.log('');
      console.log('⚠️  首次访问时浏览器会提示证书不安全，点击"高级"→"继续访问"即可');
      console.log('');
    });
  }

  // 同时启动 HTTP（用于不需要 WebUSB 的场景，或配合 Chrome flag）
  const httpServer = http.createServer(handleRequest);
  httpServer.listen(PORT_HTTP, '0.0.0.0', () => {
    console.log('🌐 HTTP 服务已启动:');
    ips.forEach(ip => {
      console.log(`   http://${ip}:${PORT_HTTP}/`);
    });
    console.log('');

    if (!certs) {
      console.log('═══════════════════════════════');
      console.log('⚠️  未能生成 HTTPS 证书，WebUSB 需要安全上下文');
      console.log('');
      console.log('请在 Chrome 地址栏输入:');
      console.log('   chrome://flags/#unsafely-treat-insecure-origin-as-secure');
      console.log('');
      console.log('然后添加以下地址并重启 Chrome:');
      ips.filter(ip => ip !== '127.0.0.1').forEach(ip => {
        console.log(`   http://${ip}:${PORT_HTTP}`);
      });
      console.log('');
    }

    console.log('按 Ctrl+C 停止服务器');
  });
}

start();

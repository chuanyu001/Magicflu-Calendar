const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = 3000;

// 允许跨域
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件服务
app.use(express.static(__dirname));

// 魔方网表服务器配置
const MAGICFLU_SERVERS = {
  'internal': 'http://172.16.2.12',
  'external': 'http://223.107.66.14:999'
};

// 请求日志中间件
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// 登录接口代理
app.post('/api/proxy/login', async (req, res) => {
  try {
    const { username, password, serverType = 'internal' } = req.body;
    const baseUrl = MAGICFLU_SERVERS[serverType];
    
    if (!baseUrl) {
      return res.status(400).json({ 
        success: false, 
        message: '无效的服务器类型' 
      });
    }
    
    // 发送登录请求到魔方网表
    const response = await axios.post(`${baseUrl}/magicflu/jwt`, 
      `j_username=${encodeURIComponent(username)}&j_password=${encodeURIComponent(password)}`,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    
    const data = response.data;
    
    if (data.status === 1) {
      res.json({
        success: true,
        token: data.token,
        userInfo: {
          username: data.username,
          nickname: data.nickname,
          id: data.id
        }
      });
    } else {
      res.json({
        success: false,
        message: '登录失败，请检查用户名和密码'
      });
    }
  } catch (error) {
    console.error('登录代理错误:', error.message);
    res.status(500).json({
      success: false,
      message: `登录失败: ${error.message}`
    });
  }
});

// API代理中间件
app.use('/api/proxy/:serverType', async (req, res) => {
  try {
    const { serverType } = req.params;
    const baseUrl = MAGICFLU_SERVERS[serverType];
    
    if (!baseUrl) {
      return res.status(400).json({ 
        success: false, 
        message: '无效的服务器类型' 
      });
    }
    
    // 获取token
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: '未提供认证token'
      });
    }
    
    // 构建目标URL
    const targetPath = req.originalUrl.replace(`/api/proxy/${serverType}`, '');
    const targetUrl = `${baseUrl}${targetPath}`;
    
    // 准备请求配置
    const config = {
      method: req.method,
      url: targetUrl,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };
    
    // 如果有请求体，添加请求体
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
      config.data = req.body;
    }
    
    // 如果有查询参数，添加查询参数
    if (Object.keys(req.query).length > 0) {
      config.params = req.query;
    }
    
    // 发送请求
    const response = await axios(config);
    
    // 返回响应
    res.json(response.data);
    
  } catch (error) {
    console.error('API代理错误:', error.message);
    
    if (error.response) {
      // 魔方网表返回的错误
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(500).json({
        success: false,
        message: `代理请求失败: ${error.message}`
      });
    }
  }
});

// 健康检查接口
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    servers: MAGICFLU_SERVERS
  });
});

// 默认路由，返回index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 404处理
app.use((req, res) => {
  res.status(404).send('页面未找到');
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('服务器错误:', err.stack);
  res.status(500).send('服务器内部错误');
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`CORS 代理服务器运行在 http://localhost:${PORT}`);
  console.log(`内网服务器地址: ${MAGICFLU_SERVERS.internal}`);
  console.log(`外网服务器地址: ${MAGICFLU_SERVERS.external}`);
  console.log(`健康检查地址: http://localhost:${PORT}/api/health`);
  console.log(`应用访问地址: http://localhost:${PORT}`);
});
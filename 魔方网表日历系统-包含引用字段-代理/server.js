const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const bodyParser = require('body-parser');
const https = require('https');
const http = require('http');
const fs = require('fs');

const app = express();
const PORT = 3000;

// 允许跨域
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 魔方网表服务器配置
const MAGICFLU_SERVERS = {
  'internal': 'http://172.16.2.12',
  'external': 'http://223.107.66.14:999'
};

// 存储token的简单内存缓存（生产环境应使用Redis等）
const tokenCache = new Map();

// 登录接口代理 - 获取token
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
    
    // 直接转发登录请求到魔方网表
    const response = await fetch(`${baseUrl}/magicflu/jwt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        j_username: username,
        j_password: password
      })
    });
    
    const data = await response.json();
    
    if (data.status === 1) {
      // 缓存token
      const cacheKey = `${username}_${serverType}`;
      tokenCache.set(cacheKey, {
        token: data.token,
        expiry: Date.now() + 30 * 60 * 1000, // 30分钟
        userInfo: {
          username: data.username,
          nickname: data.nickname,
          id: data.id
        }
      });
      
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
    console.error('登录代理错误:', error);
    res.status(500).json({
      success: false,
      message: `登录失败: ${error.message}`
    });
  }
});

// 通用的API代理中间件
const createMagicFluProxy = (serverType) => {
  return async (req, res) => {
    try {
      const baseUrl = MAGICFLU_SERVERS[serverType];
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
      
      // 获取请求方法
      const method = req.method;
      
      // 准备请求选项
      const requestOptions = {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      };
      
      // 如果有请求体，添加请求体
      if (['POST', 'PUT', 'PATCH'].includes(method) && req.body) {
        requestOptions.body = JSON.stringify(req.body);
      }
      
      // 发送请求到魔方网表
      const response = await fetch(targetUrl, requestOptions);
      
      // 获取响应数据
      const data = await response.json();
      
      // 返回响应
      res.status(response.status).json(data);
      
    } catch (error) {
      console.error('API代理错误:', error);
      res.status(500).json({
        success: false,
        message: `代理请求失败: ${error.message}`
      });
    }
  };
};

// 注册代理路由
app.use('/api/proxy/internal', createMagicFluProxy('internal'));
app.use('/api/proxy/external', createMagicFluProxy('external'));

// 静态文件服务
app.use(express.static('.'));

// 健康检查接口
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`代理服务器运行在 http://localhost:${PORT}`);
  console.log(`内部网表地址: ${MAGICFLU_SERVERS.internal}`);
  console.log(`外部网表地址: ${MAGICFLU_SERVERS.external}`);
});
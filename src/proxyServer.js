import cors from 'cors';
import { createProxyMiddleware } from 'http-proxy-middleware';
import express from 'express';

const app = express();
const corsOptions = {
    origin: 'https://localhost:8081', // Allow requests from this origin
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders: ['Content-Type', 'Authorization'], // Allow these headers
  };
app.use(cors(corsOptions));
app.use('/api', createProxyMiddleware({
	target: 'https://api.replicate.com',
	changeOrigin: true,
    logLevel: 'debug',
	onProxyRes: (proxyRes, req, res) => {
        console.log(`Received response: ${proxyRes.statusCode} for ${req.method} ${req.url}`);
        // Modify the response headers to include CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
	},
    onProxyReq: (proxyReq, req, res) => {
        console.log(`Proxying request: ${req.method} ${req.url}`);
    },
    onError: (err, req, res) => {
        console.error(`Error during proxying: ${err.message}`);
    },
}));
app.listen(3000, () => {
	console.log('Proxy server running on https://localhost:3000');
});

const CryptoJS = require('crypto-js')
const request = require('request')
const log = require('log4node')
const bodyParse = require('body-parser')
const express = require('express')
const fs = require('fs')
const cors = require('cors')
const mutipart = require('connect-multiparty');
const app = express()
const mutipartMiddeware = mutipart();
// images 实现图片压缩
const images = require("images");

app.use(mutipart())
app.use(cors())
app.use(bodyParse.urlencoded({
  extended: false
}))
app.use(bodyParse.json())

// 系统配置
const config = {
  // 请求地址
  hostUrl: "https://rest-api.xfyun.cn/v2/itr",
  host: "rest-api.xfyun.cn",
  //在控制台-我的应用-拍照速算获取
  appid: "5e82eabe",
  //在控制台-我的应用-拍照速算获取
  apiSecret: "03c1842471e025a6f3f2741b463e9e65",
  //在控制台-我的应用-拍照速算获取
  apiKey: "04f9165ab9bba13583ebc67dacbcba61",
  uri: "/v2/itr",
}

// 生成请求body    
const getPostBody = (data, ent, category) => {
  let params = {};
  let business = {};
  if (ent === "math_review") {
    business = {
      "ent": ent, //拍照印刷    
      "aue": "raw",
    };
    params = {
      image: Buffer.from(JSON.stringify(data)).toString('base64')
    }
  } else {
    images(data.path).size(500).save('test.png', {
      quality: 100
    })
    const buffer = fs.readFileSync('./test.png')
    params = {
      "image": buffer.toString('base64')
    };
    business = {
      "ent": ent, //拍照印刷    
      "aue": "raw",
      "xml": "",
      "txt_encrypted": "false",
      "category": category,
      "application_type": 'search_topic',
    };
  }

  let digestObj = {
    "common": {
      "app_id": config.appid
    },
    "business": business,
    "data": params
  }
  return digestObj
}

// 请求获取请求体签名
const getDigest = (body) => {
  return 'SHA-256=' + CryptoJS.enc.Base64.stringify(CryptoJS.SHA256(JSON.stringify(body)))
}

// 鉴权签名
const getAuthStr = (date, digest) => {
  let signatureOrigin = `host: ${config.host}\ndate: ${date}\nPOST ${config.uri} HTTP/1.1\ndigest: ${digest}`
  let signatureSha = CryptoJS.HmacSHA256(signatureOrigin, config.apiSecret)
  let signature = CryptoJS.enc.Base64.stringify(signatureSha)
  let authorizationOrigin = `api_key="${config.apiKey}", algorithm="hmac-sha256", headers="host date request-line digest", signature="${signature}"`
  return authorizationOrigin
}
// 拍照手写
app.post('/answer', mutipartMiddeware, (req, res) => {
  publicRequest(req, res, "math_demo")
})
//拍照印刷
app.post('/picture', mutipartMiddeware, (req, res) => {
  publicRequest(req, res, "math_demo")
})
//批改
app.post('/correct', mutipartMiddeware, (req, res) => {
  publicRequest(req, res, "math_review")
})

function publicRequest(req, res, ent) {
  let date = (new Date().toUTCString()) // 获取当前时间 RFC1123格式
  let param = req.url === '/correct' ? req.body : req.files.image;
  let category = req.url === '/picture' ? 'math_phpw_chapter' : 'math_phhw_application';
  let postBody = getPostBody(param, ent, category)

  let digest = getDigest(postBody)
  let options = {
    url: config.hostUrl,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json,version=1.0',
      'Host': config.host,
      'Date': date,
      'Digest': digest,
      'Authorization': getAuthStr(date, digest)
    },
    json: true,
    body: postBody
  }
  request.post(options, (err, resp, body) => {
    if (err) {
      log.error("调用失败！请根据错误信息检查代码，接口文档：https://www.xfyun.cn/doc/words/photo-calculate-recg/API.html")
    }
    if (body.code != 0) {
      //以下仅用于调试
      log.error(`发生错误，错误码：${body.code}错误原因：${body.message}`)
      log.error(`请前往https://www.xfyun.cn/document/error-code?code=${body.code}查询解决办法`)
    }
    res.send(body.data || body)
  })
}
app.listen(41200, () => {
  console.log('server on 41200')
})
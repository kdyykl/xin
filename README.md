# 🦆 可达鸭 × 亚克力

> 可达鸭有一个小小的心愿，想对亚克力说...

## 🌐 在线访问

- **首页（心动信号）**：https://kdyykl.github.io/xin/heart_popups.html
- **表白页（你喜欢我吗？）**：https://kdyykl.github.io/xin/target.html
- **成功页（我们在一起啦）**：https://kdyykl.github.io/xin/success.html

## 📷 照片服务

- 照片**原图**存在阿里云 OSS（`kdyykl-xin-photos`，华南3·广州），页面直接通过 OSS 读写，不再依赖 Supabase。
- 页面显示走 OSS 服务端实时缩略图（`x-oss-process=image/resize,w_1600`），原图保留在桶里，点开照片可「查看原图」。
- `photos/` 与 `photos.json` 是 GitHub Action 定时从 OSS 压缩同步的静态镜像（每 6 小时），仅在当前网络访问不了 OSS 时兜底。
- 上传：页面右下角 📷，支持 jpg/png/gif/webp，单张 ≤ 20MB。

### OSS 配置（Bucket `kdyykl-xin-photos`）

- ACL：私有；匿名访问通过 Bucket Policy 放行（仅 `photos/*` 的 GetObject / PutObject，以及 ListObjects）。
- CORS：允许来源 `https://kdyykl.github.io`，方法 GET/PUT/HEAD，允许 Headers `*`。
- 说明：这是「简单版」方案，拿到桶地址的人理论上也能往 `photos/` 写垃圾文件；已建议开启费用预警。若以后要更严格，可升级为函数计算（FC）签名上传。

---

*Made with 💖 by 可达鸭*

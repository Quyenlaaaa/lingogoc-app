# LingoGoc AI backend (Cloudflare Worker)

Backend này giữ API key ở phía máy chủ và cung cấp ví dụ từ vựng song ngữ đa ngữ cảnh. Cấu hình mặc định sử dụng API tương thích OpenAI của xkiro với model `x-ai/grok-build-0.1`. Vẫn có thể đổi sang Groq, OpenRouter hoặc nhà cung cấp tương thích khác.

## Chạy thử tại máy

1. Sao chép `.dev.vars.example` thành `.dev.vars`.
2. Điền `XTROUTER_API_KEY`. URL và model xkiro đã được cấu hình sẵn.
3. Chạy `npx wrangler dev` trong thư mục `backend`.
4. Đặt `VITE_API_BASE_URL=http://localhost:8787` trong file `.env` ở thư mục gốc.

Có thể kiểm tra hợp đồng API không cần khóa thật bằng `node test-worker.mjs`.

`.dev.vars` chứa khóa riêng và đã được `.gitignore` loại trừ.

## Deploy

```powershell
cd backend
npx wrangler secret put XTROUTER_API_KEY
npx wrangler deploy
```

Sau khi deploy, đặt URL Worker vào `VITE_API_BASE_URL` rồi build/deploy lại frontend. Kiểm tra `GET /health`; `aiConfigured` phải là `true`.

Các biến không bí mật đặt trong `wrangler.toml`:

- `AI_BASE_URL`: URL gốc API tương thích OpenAI, không gồm `/chat/completions` (mặc định `https://api.xkiro.com/v1`).
- `AI_MODEL`: mã model chính xác do nhà cung cấp cấp.
- `ALLOWED_ORIGINS`: danh sách origin frontend, phân cách bằng dấu phẩy.

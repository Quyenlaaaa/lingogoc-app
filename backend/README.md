# LingoGoc AI backend (Cloudflare Worker)

Backend này giữ API key ở phía máy chủ và cung cấp ví dụ từ vựng song ngữ đa ngữ cảnh. Cấu hình mặc định sử dụng API tương thích OpenAI của xkiro với model `mistralai/mistral-large-2512`. Vẫn có thể đổi sang Groq, OpenRouter hoặc nhà cung cấp tương thích khác.

Ví dụ đã sinh được lưu bền vững trong Cloudflare Workers KV qua binding `VOCAB_CACHE`. Khóa lưu được chuẩn hóa theo phiên bản prompt, model và từ vựng, vì vậy Danh sách 3000, Thẻ nhớ 3D và các thiết bị khác nhau dùng chung một bản ghi mà không gọi lại AI.

Nếu provider phản hồi chậm, lỗi tạm thời hoặc trả JSON chưa đủ ví dụ, Worker sẽ tự gọi lại. Ở frontend, thao tác “Thử lại AI” tiếp tục retry với backoff cho đến khi nhận được kết quả hợp lệ. Việc chuyển tab hoặc đóng modal trong ứng dụng không hủy request; kết quả hoàn tất trong nền vẫn được lưu để hiển thị khi người dùng quay lại.

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

Namespace KV hiện được khai báo trong `wrangler.toml`. Nếu triển khai sang một tài khoản Cloudflare khác, tạo namespace mới bằng:

```powershell
npx wrangler kv namespace create lingogoc-vocabulary-ai --binding VOCAB_CACHE
```

Sau đó đặt `id` được trả về vào mục `[[kv_namespaces]]` trong `wrangler.toml`.

Sau khi deploy, đặt URL Worker vào `VITE_API_BASE_URL` rồi build/deploy lại frontend. Kiểm tra `GET /health`; `aiConfigured` phải là `true`.

Các biến không bí mật đặt trong `wrangler.toml`:

- `AI_BASE_URL`: URL gốc API tương thích OpenAI, không gồm `/chat/completions` (mặc định `https://api.xkiro.com/v1`).
- `AI_MODEL`: mã model chính xác do nhà cung cấp cấp.
- `ALLOWED_ORIGINS`: danh sách origin frontend, phân cách bằng dấu phẩy.

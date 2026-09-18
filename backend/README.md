# LingoGoc AI backend (Cloudflare Worker)

## Automatic vocabulary backfill

The Worker Cron Trigger runs every 15 minutes and enriches at most two missing words per run. Its checkpoint is stored in Workers KV, so processing continues without a browser or local process. Scheduled bulk work uses only the free model and can never spend the paid-model wallet; quota failures pause the queue for six hours, then retry the same word automatically. Interactive requests retain the configured paid fallback. Inspect progress with `GET /api/vocabulary/backfill/status`; `npm run backfill:vocab` remains available for manual runs.

Backend này giữ API key ở phía máy chủ và cung cấp ví dụ từ vựng song ngữ đa ngữ cảnh. Cấu hình mặc định dùng chung API tương thích OpenAI của xkiro: ưu tiên model miễn phí `mistralai/mistral-large-2512`, sau đó tự chuyển sang model trả phí `x-ai/grok-build-0.1` khi model miễn phí báo hết quota hoặc rate limit kéo dài.

Sau lỗi quota rõ ràng, Worker tạm ngừng thăm dò model miễn phí trong 5 phút để hàng đợi nền không lặp lại một request chắc chắn thất bại trước mỗi request trả phí. Hết thời gian này, Worker tự thử model miễn phí trước trở lại.

Ví dụ đã sinh được lưu bền vững trong Cloudflare Workers KV qua binding `VOCAB_CACHE`. Khóa lưu được chuẩn hóa theo phiên bản prompt, model và từ vựng, vì vậy Danh sách 3000, Thẻ nhớ 3D và các thiết bị khác nhau dùng chung một bản ghi mà không gọi lại AI.

Kho 3.000 từ nền (từ, IPA, nghĩa và ví dụ song ngữ) cũng được lưu trong KV tại khóa `system-vocabulary:v1`. Frontend đọc khóa này qua `GET /api/vocabulary/catalog`; dữ liệu đóng gói chỉ được dùng khi backend tạm thời không khả dụng.

Frontend hiển thị snapshot đóng gói trước, sau đó gọi `GET /api/vocabulary/manifest` để so hash trong nền. `POST /api/vocabulary/batch` chỉ đọc tối đa 24 bản ghi nghĩa/ví dụ từ KV và không gọi model. Việc bổ sung toàn kho được thực hiện bởi pipeline quản trị `npm run backfill:vocab`, có checkpoint và giới hạn mặc định 100 từ mỗi lượt.

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
cd ..
npm run sync:vocab-db
```

Lệnh đồng bộ kiểm tra đúng 3.000 từ hợp lệ rồi ghi catalog thành một khóa KV duy nhất, tránh vượt hạn mức ghi hằng ngày của gói miễn phí. Có thể kiểm tra mà không ghi DB bằng `node scripts/sync-vocabulary-kv.mjs --dry-run`.

Namespace KV hiện được khai báo trong `wrangler.toml`. Nếu triển khai sang một tài khoản Cloudflare khác, tạo namespace mới bằng:

```powershell
npx wrangler kv namespace create lingogoc-vocabulary-ai --binding VOCAB_CACHE
```

Sau đó đặt `id` được trả về vào mục `[[kv_namespaces]]` trong `wrangler.toml`.

Sau khi deploy, đặt URL Worker vào `VITE_API_BASE_URL` rồi build/deploy lại frontend. Kiểm tra `GET /health`; `aiConfigured` phải là `true`.

Các biến không bí mật đặt trong `wrangler.toml`:

- `AI_BASE_URL`: URL gốc API tương thích OpenAI, không gồm `/chat/completions` (mặc định `https://api.xkiro.com/v1`).
- `AI_FREE_MODEL`: model được gọi trước cho mọi request.
- `AI_PAID_MODEL`: model dự phòng chỉ được gọi khi model miễn phí báo hết quota/rate limit; để trống để tắt fallback trả phí.
- `AI_MODEL`: tên biến tương thích với cấu hình cũ, chỉ được dùng khi chưa có `AI_FREE_MODEL`.
- `ALLOWED_ORIGINS`: danh sách origin frontend, phân cách bằng dấu phẩy.

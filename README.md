# LingoGoc AI

Ứng dụng tự học tiếng Anh dành cho người Việt muốn xây lại nền tảng từ phát âm, từ vựng, phản xạ đến hội thoại. LingoGoc có bản web responsive và bản Android viết bằng Kotlin; tiến độ học được lưu ngay trên thiết bị.

**Bản đang hoạt động:** [https://quyenlaaaa.github.io/lingogoc-app/](https://quyenlaaaa.github.io/lingogoc-app/)

## Tính năng chính

- Lộ trình học theo 4 chặng: phát âm, từ vựng, phản xạ và luyện nói.
- Kiểm tra đầu vào và gợi ý chặng học phù hợp.
- Kho từ vựng, thẻ nhớ 3D, tìm kiếm, lọc theo cấp độ và chủ đề.
- AI bổ sung chính xác 5 ví dụ song ngữ thuộc 5 ngữ cảnh khác nhau cho mỗi từ.
- Định nghĩa, IPA, cụm từ đi kèm, họ từ, mẹo ghi nhớ và dữ liệu đối chiếu từ điển.
- Ôn tập ngắt quãng theo thuật toán SM-2.
- Luyện phát âm và nhận diện giọng nói qua microphone.
- Một giọng Anh-Mỹ thống nhất cho từ và câu trên cả desktop lẫn mobile.
- Luyện phản xạ, hội thoại AI, nghe chép chính tả và Audio Pod.
- Tiếng Anh ngành IT, bẫy lỗi sai, đấu trường 60 giây và bảng xếp hạng.
- Theo dõi XP, chuỗi ngày học, tiến độ và chứng chỉ.
- Giao diện sáng/tối, responsive và hỗ trợ safe area trên điện thoại.

## Công nghệ

| Thành phần | Công nghệ |
| --- | --- |
| Frontend | React 19, Vite 8, CSS thuần, Lucide React |
| Android | Kotlin, Android WebView, WebViewAssetLoader, native TTS |
| Backend | Cloudflare Workers |
| Lưu kết quả AI | Cloudflare Workers KV |
| AI | API tương thích OpenAI, cấu hình hoàn toàn ở backend |
| Từ điển | Free Dictionary API; Cambridge là tích hợp tùy chọn |
| Giọng đọc | Audio endpoint qua backend, Web Speech API làm phương án dự phòng |
| Dữ liệu cục bộ | localStorage và IndexedDB |
| Hosting | GitHub Pages và Cloudflare Workers |

## Kiến trúc tổng quan

```text
Trình duyệt
├── React UI
├── tiến độ và cài đặt cục bộ
├── cache từ vựng/AI
└── microphone + audio player
        │
        ▼
Cloudflare Worker
├── tạo 5 ví dụ đa ngữ cảnh
├── hội thoại AI
├── proxy và cache audio
└── lưu kết quả AI vào Workers KV
        │
        ├── API AI tương thích OpenAI
        ├── dịch vụ TTS
        └── nguồn từ điển
```

Khóa API không được gửi xuống frontend. Frontend chỉ biết URL công khai của Worker qua `VITE_API_BASE_URL`.

## Yêu cầu

- Node.js `20.19+` hoặc `22.12+`.
- npm.
- Tài khoản Cloudflare nếu cần chạy hoặc triển khai backend AI.
- API key của một nhà cung cấp tương thích OpenAI nếu cần sinh nội dung AI.

## Chạy frontend tại máy

```bash
git clone https://github.com/Quyenlaaaa/lingogoc-app.git
cd lingogoc-app
cd web
npm install
```

Sao chép `.env.example` thành `.env` và đặt URL backend:

```env
VITE_API_BASE_URL=http://localhost:8787
VITE_SPEAKING_AUTO_LISTEN=true
```

Khởi động ứng dụng:

```bash
npm run dev
```

Frontend mặc định chạy tại `http://localhost:5173`.

## Chạy backend tại máy

Sao chép `backend/.dev.vars.example` thành `backend/.dev.vars`:

```env
XTROUTER_API_KEY=your_secret_key
AI_FREE_MODEL=mistralai/mistral-large-2512
AI_PAID_MODEL=x-ai/grok-build-0.1
AI_BASE_URL=https://api.xkiro.com/v1
ALLOWED_ORIGINS=http://localhost:5173
```

Sau đó chạy Worker:

```bash
cd backend
npx wrangler dev
```

Không commit `.env`, `backend/.dev.vars` hoặc bất kỳ API key nào. Các tệp này đã được loại trừ trong `.gitignore`.

## Các lệnh hữu ích

```bash
npm run dev          # chạy frontend ở chế độ phát triển
npm run build        # tạo production build trong dist/
npm run preview      # xem thử production build
npm run lint         # kiểm tra mã nguồn
npm run test:speech  # kiểm tra cơ chế giọng đọc
npm run test:vocab   # kiểm tra chất lượng dữ liệu từ vựng
node backend/test-worker.mjs  # kiểm tra hợp đồng API của Worker
```

## API backend

| Phương thức | Endpoint | Chức năng |
| --- | --- | --- |
| `GET` | `/health` | Kiểm tra trạng thái backend và cấu hình AI/KV |
| `GET` | `/api/vocabulary/manifest` | Kiểm tra nhanh phiên bản/hash catalog mà không tải 3.000 từ |
| `GET` | `/api/vocabulary/catalog` | Đọc kho 3.000 từ hệ thống đã đồng bộ trên Workers KV |
| `POST` | `/api/vocabulary/batch` | Đọc nghĩa và ví dụ đã có trong KV cho tối đa 24 từ, không gọi AI |
| `POST` | `/api/vocabulary/enrich` | Sinh và lưu bộ dữ liệu từ vựng với 5 ngữ cảnh khác nhau |
| `POST` | `/api/vocabulary/meanings` | Chuẩn hóa nhanh nghĩa tiếng Việt theo lô, tối đa 30 từ |
| `GET` | `/api/vocabulary/pronunciation?word=hello` | Audio phát âm tương thích ngược cho từ đơn |
| `GET` | `/api/speech/audio?text=How%20are%20you%3F&lang=en-US` | Audio thống nhất cho từ hoặc câu |
| `GET` | `/api/vocabulary/cambridge?word=hello` | Tích hợp Cambridge tùy chọn; trả `204` khi chưa cấu hình |
| `POST` | `/api/speaking/chat` | Trả lời hội thoại và gợi ý sửa câu |

Chi tiết request/response nằm trong [BACKEND_API.md](./web/BACKEND_API.md) và [backend/README.md](./web/backend/README.md).

### Dữ liệu AI và retry

- Kết quả chỉ được chấp nhận khi có đủ 5 ví dụ song ngữ thuộc 5 ngữ cảnh riêng biệt.
- Mỗi thao tác tương tác chỉ tạo tối đa một yêu cầu AI. Sau lỗi, trình duyệt và Worker chờ 1 giờ trước khi tự động gọi lại; nút **Thử lại AI** cho phép người dùng chủ động gọi ngay.
- Cron backend chạy vào đầu mỗi giờ, bỏ qua từ đã đủ 5 ngữ cảnh và chỉ bổ sung các từ còn thiếu; mỗi lượt được giới hạn tối đa 2 từ để kiểm soát token.
- Kết quả hợp lệ được lưu trong Workers KV và cache ở trình duyệt.
- Việc đóng modal hoặc chuyển màn hình không hủy yêu cầu đang chạy; khi hoàn tất, dữ liệu vẫn được lưu để sử dụng lại.
- Trình duyệt chỉ đọc dữ liệu của màn hình hiện tại theo lô; không chạy hàng đợi AI 3.000 từ trên thiết bị người học.
- Pipeline quản trị `npm run backfill:vocab` quét KV trước, chỉ gọi AI cho từ còn thiếu và lưu checkpoint để tiếp tục vào ngày sau.

## Kho từ vựng hệ thống

Người học luôn sử dụng kho 3.000 từ do hệ thống quản lý. Bản chính được đọc từ Workers KV qua `/api/vocabulary/catalog`; bản trong `web/src/data/vocabData.js` là dữ liệu dự phòng khi server tạm thời không khả dụng. IPA trong bản đóng gói được kiểm tra để không dùng lại chính cách viết tiếng Anh làm phiên âm.

Phiên âm được bổ sung từ bộ dữ liệu mã nguồn mở `open-dict-data/ipa-dict`; thông tin giấy phép nằm trong [web/THIRD_PARTY_NOTICES.md](./web/THIRD_PARTY_NOTICES.md).

Sau khi cập nhật kho từ, đồng bộ toàn bộ từ, IPA, nghĩa và ví dụ lên KV bằng một lượt ghi:

```bash
npm run sync:vocab-db
```

Script chỉ thực hiện đồng bộ khi kho sau kiểm tra có đúng 3.000 từ hợp lệ và duy nhất.

Kiểm tra chất lượng bản phát hành và bổ sung tối đa 100 từ còn thiếu mỗi lượt:

```bash
npm run audit:vocab
npm run backfill:vocab
```

Checkpoint nằm trong `web/scripts/data_cache` (không commit). Chỉ dùng `npm run sync:vocab-db` để phát hành catalog; người dùng không tham gia quá trình tạo dữ liệu AI.

## Quyền riêng tư và bảo mật

- Tiến độ và cài đặt người học được lưu trên thiết bị hiện tại.
- Nội dung AI đã chuẩn hóa có thể được lưu trên Workers KV để dùng lại giữa các thiết bị.
- API key chỉ tồn tại trong secret của Cloudflare Worker.
- Nên xuất bản sao lưu trước khi xóa dữ liệu trình duyệt.
- Không ghi khóa bí mật hoặc dữ liệu học cá nhân vào source control.

## Triển khai

### Backend

```bash
cd web
cd backend
npx wrangler secret put XTROUTER_API_KEY
npx wrangler deploy
cd ..
npm run sync:vocab-db
```

Sau khi triển khai, kiểm tra `/health` và bảo đảm `aiConfigured` là `true`.

### Frontend

Cập nhật `VITE_API_BASE_URL` thành URL Worker production rồi chạy:

```bash
cd web
npm run deploy
```

Lệnh này build ứng dụng và xuất bản thư mục `dist` lên nhánh GitHub Pages.

## Cấu trúc thư mục

```text
lingogoc-app/
├── web/                  # React, Cloudflare Worker, dữ liệu và script quản trị web
│   ├── backend/          # Cloudflare Worker, cấu hình và test API
│   ├── public/           # tài nguyên tĩnh của frontend
│   ├── scripts/          # kiểm thử, audit và đồng bộ kho từ
│   └── src/              # giao diện, dữ liệu và tiện ích web
├── app/                  # ứng dụng Android Kotlin và hướng dẫn tạo APK
├── .github/              # workflow build/deploy
└── README.md
```

## Đóng góp

1. Tạo branch riêng cho thay đổi.
2. Không đưa khóa bí mật hoặc dữ liệu cá nhân vào commit.
3. Chạy build, lint và các bài test liên quan.
4. Mở pull request, mô tả vấn đề và cách đã kiểm tra.

---

**LingoGoc — Mỗi ngày một bước, xây lại gốc tiếng Anh.**

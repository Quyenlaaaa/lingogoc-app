# LingoGoc backend contract

Frontend chỉ biết `VITE_API_BASE_URL`. Mọi khóa xkiro, Groq, OpenRouter hoặc Cambridge phải nằm trong secret của backend và không được trả về client. Worker mẫu đang dùng `XTROUTER_API_KEY`, endpoint `https://api.xkiro.com/v1` và model `x-ai/grok-build-0.1`.

Một backend Cloudflare Worker mẫu đã có tại `backend/`. Xem `backend/README.md` để chạy local và deploy. Khi backend được cấu hình, Danh sách 3000 tự tải ví dụ AI với tối đa 2 request đồng thời; Thẻ nhớ 3D tải theo thẻ đang mở. Kết quả hợp lệ được lưu trong localStorage để tiết kiệm quota.

## `POST /api/vocabulary/enrich`

Request:

```json
{
  "word": "accept",
  "meaning": "chấp nhận",
  "topic": "Giao tiếp",
  "dictionaryDefinitions": [{ "partOfSpeech": "verb", "text": "..." }]
}
```

Response có thể bọc trong `{ "data": ... }` hoặc trả trực tiếp:

```json
{
  "primaryMeaningVi": "chấp nhận",
  "meaningNote": "...",
  "senses": [{ "pos": "verb", "meaningVi": "...", "usage": "..." }],
  "contextExamples": [
    { "context": "Công việc", "en": "I accepted the offer.", "vi": "Tôi đã nhận lời đề nghị." },
    { "context": "Hội thoại", "en": "Please accept my apology.", "vi": "Xin hãy chấp nhận lời xin lỗi của tôi." }
  ],
  "collocations": [{ "phrase": "accept an offer", "meaning": "chấp nhận một lời đề nghị" }],
  "mnemonicTip": "...",
  "wordFamily": "..."
}
```

## `GET /api/vocabulary/cambridge?word=accept`

Đây là tích hợp tùy chọn. Nếu backend chưa có nhà cung cấp Cambridge được cấp phép, endpoint trả `204 No Content`; frontend sẽ tiếp tục dùng Free Dictionary và AI mà không hiển thị lỗi.

Response:

```json
{
  "word": "accept",
  "phonetic": "/əkˈsept/",
  "definitions": ["..."],
  "examples": ["..."],
  "entryUrl": "https://dictionary.cambridge.org/...",
  "dictionaryCode": "british"
}
```

## `POST /api/speaking/chat`

Request gồm `scenario` và tối đa 12 phần tử `messages`. Response:

```json
{
  "replyEn": "That sounds great. What happened next?",
  "replyVi": "Nghe tuyệt đấy. Sau đó chuyện gì xảy ra?",
  "correction": "",
  "encouragement": "Bạn diễn đạt rất tự nhiên!",
  "hints": [{ "en": "Then I went home.", "vi": "Sau đó tôi về nhà." }]
}
```

## `POST /api/speaking/speech`

Request: `{ "text": "Hello", "voice": "optional" }`. Response là audio blob. Nếu endpoint lỗi, frontend tự chuyển sang giọng đọc của trình duyệt.

Backend cần cho phép CORS từ domain frontend, kiểm tra độ dài request, giới hạn tốc độ và không ghi log nội dung nhạy cảm.

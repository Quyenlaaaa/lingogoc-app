# LingoGoc backend contract

Frontend chỉ biết `VITE_API_BASE_URL`. Mọi khóa xkiro, Groq, OpenRouter hoặc Cambridge phải nằm trong secret của backend và không được trả về client. Worker dùng `XTROUTER_API_KEY`, endpoint `https://api.xkiro.com/v1`, ưu tiên `AI_FREE_MODEL=mistralai/mistral-large-2512` và fallback `AI_PAID_MODEL=x-ai/grok-build-0.1` khi model miễn phí hết quota.

Một backend Cloudflare Worker mẫu đã có tại `backend/`. Xem `backend/README.md` để chạy local và deploy. Khi backend được cấu hình, Danh sách 3000 tải tuần tự từng từ để phù hợp quota miễn phí; Thẻ nhớ 3D tải theo thẻ đang mở. Kết quả hợp lệ được lưu lâu dài trên Cloudflare Workers KV, đồng thời cache trong localStorage và IndexedDB để mở lại tức thì. Nếu người dùng xóa dữ liệu trình duyệt, ứng dụng tải lại bản đã lưu trên KV mà không gọi AI. Worker tự thử lại tối đa 3 lần khi nhà cung cấp trả `429` hoặc lỗi `5xx`.

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

## `POST /api/vocabulary/meanings`

Chuẩn hóa nghĩa tiếng Việt theo lô để hiển thị nhanh trong danh sách, flashcard và trắc nghiệm. Mỗi request nhận tối đa 30 từ. Backend ưu tiên kết quả enrichment/Workers KV đã có và chỉ gọi AI một lần cho các mục còn thiếu.

Request:

```json
{
  "items": [
    { "word": "abandon", "pos": "v", "meaning": "bộm từ bỏ" },
    { "word": "ability", "pos": "n", "meaning": "năng lực, khả năng" }
  ]
}
```

Response:

```json
{
  "data": {
    "meanings": [
      { "word": "abandon", "meaningVi": "từ bỏ; bỏ rơi", "source": "ai" },
      { "word": "ability", "meaningVi": "khả năng; năng lực", "source": "meaning-cache" }
    ]
  }
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

# LingoGoc

Ứng dụng tự học tiếng Anh dành cho người Việt muốn xây lại nền tảng: phát âm, từ vựng, ôn tập ngắt quãng, phản xạ và luyện nói.

## Chạy trên máy

```bash
npm install
npm run dev
```

Build production bằng `npm run build`.

## Kho dữ liệu cá nhân

Mở **Cài đặt → Kho dữ liệu cá nhân** để nhập JSON hoặc CSV. Dữ liệu nhập được lưu trong trình duyệt (`localStorage`), không gửi lên server và không được ghi vào Git.

Hai trường bắt buộc là `word` và `meaning`. Các trường hỗ trợ:

```text
word, meaning, ipa, level, topic, example, exampleVi
```

Ví dụ JSON:

```json
{
  "words": [
    {
      "word": "hello",
      "meaning": "xin chào",
      "ipa": "/həˈləʊ/",
      "level": "A1",
      "topic": "Giao tiếp",
      "example": "Hello, how are you?",
      "exampleVi": "Xin chào, bạn khỏe không?"
    }
  ]
}
```

Các thư mục `private-data/`, `public/private-data/` và tệp `*.lingogoc-private.json` đã được chặn trong `.gitignore`. Không đặt dữ liệu cá nhân trong `src/data`.

## Quyền riêng tư

- Tiến độ và kho từ cá nhân mặc định chỉ tồn tại trên thiết bị/trình duyệt hiện tại.
- Hãy xuất tệp sao lưu trong Cài đặt trước khi xóa dữ liệu trình duyệt.
- API key Gemini hiện được lưu cục bộ. Không commit API key vào mã nguồn.

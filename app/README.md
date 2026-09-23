# LingoGoc Android (Kotlin)

Đây là phiên bản Android viết bằng Kotlin. Ứng dụng đóng gói bản frontend đã build vào APK và chạy qua `WebViewAssetLoader`, vì vậy giao diện, tiến độ cục bộ và kho từ điển đi kèm có thể mở khi không có mạng. Các tính năng AI, đồng bộ dữ liệu mới và audio từ máy chủ vẫn cần Internet.

## Yêu cầu

- Android Studio với JDK 17.
- Android SDK 35.
- Node.js và npm (Gradle tự chạy `npm run build` để đóng gói frontend).

## Chạy trong Android Studio

1. Mở thư mục `app` bằng Android Studio.
2. Chờ Gradle Sync hoàn tất.
3. Chọn máy Android thật hoặc emulator API 26 trở lên.
4. Bấm **Run app**.

## Tạo APK debug

Từ thư mục `app`:

```powershell
.\gradlew.bat assembleDebug
```

APK được tạo tại `app/app/build/outputs/apk/debug/app-debug.apk`.

Sau khi code được đẩy lên nhánh `main`, workflow **Android Kotlin APK** cũng tự build và đăng APK debug trong mục Artifacts của GitHub Actions.

## Tạo bản phát hành

Tạo keystore trong Android Studio, sau đó chọn **Build > Generate Signed Bundle / APK**. Không commit keystore hoặc mật khẩu ký ứng dụng vào Git.

## Tích hợp native

- Kotlin quản lý vòng đời WebView và điều hướng Back.
- Nội dung web được phục vụ bằng origin HTTPS nội bộ an toàn.
- Quyền microphone chỉ được xin khi chức năng luyện nói cần dùng.
- Kotlin Text-to-Speech là phương án phát giọng cho các preset giọng trên Android.
- Kotlin SpeechRecognizer hỗ trợ luyện nói ngay cả khi WebView không cung cấp Web Speech API.
- Nhập bản sao JSON dùng bộ chọn tệp Android.
- Xuất bản sao JSON dùng hộp thoại lưu tệp Android.

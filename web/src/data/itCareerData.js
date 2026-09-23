const entries = [
  // 1. Computer fundamentals
  ['Nền tảng máy tính', 'hardware', 'n', 'phần cứng', 'The company upgraded the hardware in every workstation.', 'Công ty đã nâng cấp phần cứng cho mọi máy trạm.'],
  ['Nền tảng máy tính', 'software', 'n', 'phần mềm', 'This software helps the team manage customer requests.', 'Phần mềm này giúp nhóm quản lý yêu cầu của khách hàng.'],
  ['Nền tảng máy tính', 'operating system', 'n', 'hệ điều hành', 'The application runs on more than one operating system.', 'Ứng dụng chạy trên nhiều hệ điều hành.'],
  ['Nền tảng máy tính', 'memory', 'n', 'bộ nhớ', 'The process is using too much memory.', 'Tiến trình đang sử dụng quá nhiều bộ nhớ.'],
  ['Nền tảng máy tính', 'storage', 'n', 'bộ nhớ lưu trữ; dung lượng lưu trữ', 'We need more storage for the backup files.', 'Chúng ta cần thêm dung lượng lưu trữ cho các tệp sao lưu.'],
  ['Nền tảng máy tính', 'file system', 'n', 'hệ thống tệp', 'The file system controls how data is stored and retrieved.', 'Hệ thống tệp kiểm soát cách dữ liệu được lưu và truy xuất.'],
  ['Nền tảng máy tính', 'command line', 'n', 'dòng lệnh; giao diện dòng lệnh', 'I used the command line to start the development server.', 'Tôi dùng dòng lệnh để khởi động máy chủ phát triển.'],
  ['Nền tảng máy tính', 'process', 'n', 'tiến trình đang chạy', 'This process continues to run in the background.', 'Tiến trình này tiếp tục chạy trong nền.'],

  // 2. Programming
  ['Lập trình', 'variable', 'n', 'biến', 'Store the user name in a variable.', 'Hãy lưu tên người dùng vào một biến.'],
  ['Lập trình', 'function', 'n', 'hàm', 'This function validates the email address.', 'Hàm này kiểm tra tính hợp lệ của địa chỉ email.'],
  ['Lập trình', 'parameter', 'n', 'tham số', 'The function accepts the file name as a parameter.', 'Hàm nhận tên tệp làm tham số.'],
  ['Lập trình', 'return value', 'n', 'giá trị trả về', 'Check the return value before continuing.', 'Hãy kiểm tra giá trị trả về trước khi tiếp tục.'],
  ['Lập trình', 'condition', 'n', 'điều kiện', 'The message appears only when this condition is true.', 'Thông báo chỉ xuất hiện khi điều kiện này đúng.'],
  ['Lập trình', 'loop', 'n', 'vòng lặp', 'The loop processes every item in the list.', 'Vòng lặp xử lý từng phần tử trong danh sách.'],
  ['Lập trình', 'array', 'n', 'mảng', 'The results are stored in an array.', 'Các kết quả được lưu trong một mảng.'],
  ['Lập trình', 'object', 'n', 'đối tượng', 'The API returns a JSON object.', 'API trả về một đối tượng JSON.'],
  ['Lập trình', 'algorithm', 'n', 'thuật toán', 'We improved the search algorithm to make it faster.', 'Chúng tôi cải thiện thuật toán tìm kiếm để nó nhanh hơn.'],
  ['Lập trình', 'data structure', 'n', 'cấu trúc dữ liệu', 'Choose a data structure that supports fast lookup.', 'Hãy chọn cấu trúc dữ liệu hỗ trợ tra cứu nhanh.'],

  // 3. Web development
  ['Phát triển web', 'front end', 'n', 'phần giao diện người dùng', 'The front end sends a request to the API.', 'Phần giao diện gửi một yêu cầu tới API.'],
  ['Phát triển web', 'back end', 'n', 'phần xử lý phía máy chủ', 'The back end checks the user credentials.', 'Phần máy chủ kiểm tra thông tin đăng nhập của người dùng.'],
  ['Phát triển web', 'full-stack developer', 'n', 'lập trình viên full-stack', 'A full-stack developer works on both the client and server sides.', 'Lập trình viên full-stack làm việc ở cả phía máy khách và máy chủ.'],
  ['Phát triển web', 'user interface', 'n', 'giao diện người dùng', 'The new user interface is easier to navigate.', 'Giao diện người dùng mới dễ điều hướng hơn.'],
  ['Phát triển web', 'responsive', 'adj', 'thích ứng với nhiều kích thước màn hình', 'The page must be responsive on phones and tablets.', 'Trang phải hiển thị thích ứng trên điện thoại và máy tính bảng.'],
  ['Phát triển web', 'request', 'n', 'yêu cầu gửi tới máy chủ', 'The browser sends a request for the latest data.', 'Trình duyệt gửi yêu cầu lấy dữ liệu mới nhất.'],
  ['Phát triển web', 'response', 'n', 'phản hồi từ máy chủ', 'The server returned a successful response.', 'Máy chủ trả về phản hồi thành công.'],
  ['Phát triển web', 'endpoint', 'n', 'điểm cuối API', 'This endpoint creates a new account.', 'Điểm cuối API này tạo một tài khoản mới.'],
  ['Phát triển web', 'authentication', 'n', 'xác thực danh tính', 'Authentication confirms who the user is.', 'Xác thực giúp xác nhận người dùng là ai.'],
  ['Phát triển web', 'authorization', 'n', 'phân quyền truy cập', 'Authorization determines what the user can access.', 'Phân quyền xác định người dùng có thể truy cập nội dung nào.'],

  // 4. Git and collaboration
  ['Git & cộng tác', 'repository', 'n', 'kho mã nguồn', 'Clone the repository before creating a new branch.', 'Hãy sao chép kho mã nguồn trước khi tạo nhánh mới.'],
  ['Git & cộng tác', 'commit', 'n/v', 'bản ghi thay đổi; ghi nhận thay đổi', 'Create a small commit with a clear message.', 'Hãy tạo một commit nhỏ với thông điệp rõ ràng.'],
  ['Git & cộng tác', 'branch', 'n', 'nhánh mã nguồn', 'I created a branch for the login feature.', 'Tôi đã tạo một nhánh cho tính năng đăng nhập.'],
  ['Git & cộng tác', 'merge', 'v', 'hợp nhất mã nguồn', 'We can merge the change after the review.', 'Chúng ta có thể hợp nhất thay đổi sau khi duyệt mã.'],
  ['Git & cộng tác', 'pull request', 'n', 'yêu cầu hợp nhất mã', 'She opened a pull request and requested two reviewers.', 'Cô ấy mở một pull request và yêu cầu hai người duyệt.'],
  ['Git & cộng tác', 'code review', 'n', 'quá trình duyệt mã', 'The code review found a possible security issue.', 'Quá trình duyệt mã phát hiện một vấn đề bảo mật có thể xảy ra.'],
  ['Git & cộng tác', 'merge conflict', 'n', 'xung đột khi hợp nhất mã', 'I resolved the merge conflict locally.', 'Tôi đã xử lý xung đột hợp nhất trên máy.'],
  ['Git & cộng tác', 'revert', 'v', 'hoàn tác một thay đổi', 'We reverted the change because it caused an error.', 'Chúng tôi hoàn tác thay đổi vì nó gây ra lỗi.'],

  // 5. Database and data
  ['Dữ liệu & cơ sở dữ liệu', 'database', 'n', 'cơ sở dữ liệu', 'The application stores customer data in a database.', 'Ứng dụng lưu dữ liệu khách hàng trong cơ sở dữ liệu.'],
  ['Dữ liệu & cơ sở dữ liệu', 'table', 'n', 'bảng dữ liệu', 'The orders table contains one row per order.', 'Bảng đơn hàng chứa một hàng cho mỗi đơn hàng.'],
  ['Dữ liệu & cơ sở dữ liệu', 'column', 'n', 'cột dữ liệu', 'Add a column for the account status.', 'Hãy thêm một cột cho trạng thái tài khoản.'],
  ['Dữ liệu & cơ sở dữ liệu', 'query', 'n/v', 'truy vấn; thực hiện truy vấn', 'This query returns all active users.', 'Truy vấn này trả về tất cả người dùng đang hoạt động.'],
  ['Dữ liệu & cơ sở dữ liệu', 'schema', 'n', 'lược đồ; cấu trúc cơ sở dữ liệu', 'The schema describes the tables and their relationships.', 'Lược đồ mô tả các bảng và mối quan hệ giữa chúng.'],
  ['Dữ liệu & cơ sở dữ liệu', 'primary key', 'n', 'khóa chính', 'Each record has a unique primary key.', 'Mỗi bản ghi có một khóa chính duy nhất.'],
  ['Dữ liệu & cơ sở dữ liệu', 'index', 'n', 'chỉ mục', 'The index makes this query much faster.', 'Chỉ mục giúp truy vấn này nhanh hơn nhiều.'],
  ['Dữ liệu & cơ sở dữ liệu', 'migration', 'n', 'thay đổi có kiểm soát đối với cấu trúc dữ liệu', 'Run the database migration before starting the new version.', 'Hãy chạy migration cơ sở dữ liệu trước khi khởi động phiên bản mới.'],

  // 6. Cloud and deployment
  ['Cloud & triển khai', 'deployment', 'n', 'việc triển khai ứng dụng', 'The deployment completed without errors.', 'Quá trình triển khai hoàn tất mà không có lỗi.'],
  ['Cloud & triển khai', 'environment', 'n', 'môi trường chạy ứng dụng', 'Never use production credentials in the test environment.', 'Không bao giờ dùng thông tin xác thực production trong môi trường kiểm thử.'],
  ['Cloud & triển khai', 'production', 'n/adj', 'môi trường thực tế phục vụ người dùng', 'The fix is ready to go to production.', 'Bản sửa đã sẵn sàng đưa lên môi trường thực tế.'],
  ['Cloud & triển khai', 'staging', 'n', 'môi trường kiểm thử gần giống production', 'Please verify the feature on staging first.', 'Vui lòng kiểm tra tính năng trên môi trường staging trước.'],
  ['Cloud & triển khai', 'container', 'n', 'gói ứng dụng cô lập cùng các phụ thuộc', 'The service runs inside a container.', 'Dịch vụ chạy bên trong một container.'],
  ['Cloud & triển khai', 'pipeline', 'n', 'chuỗi bước tự động hóa build và triển khai', 'The pipeline runs the tests before deployment.', 'Pipeline chạy kiểm thử trước khi triển khai.'],
  ['Cloud & triển khai', 'monitoring', 'n', 'việc giám sát hệ thống', 'Monitoring helps us detect failures early.', 'Việc giám sát giúp chúng ta phát hiện sự cố sớm.'],
  ['Cloud & triển khai', 'scalable', 'adj', 'có khả năng mở rộng', 'The system must be scalable during peak traffic.', 'Hệ thống phải có khả năng mở rộng khi lưu lượng đạt đỉnh.'],

  // 7. Debugging and quality
  ['Debug & chất lượng', 'bug', 'n', 'lỗi trong phần mềm', 'The bug affects users on mobile devices.', 'Lỗi này ảnh hưởng đến người dùng thiết bị di động.'],
  ['Debug & chất lượng', 'reproduce', 'v', 'tái hiện lỗi', 'Can you reproduce the issue on your computer?', 'Bạn có thể tái hiện vấn đề trên máy của mình không?'],
  ['Debug & chất lượng', 'root cause', 'n', 'nguyên nhân gốc rễ', 'We found the root cause in the caching logic.', 'Chúng tôi tìm thấy nguyên nhân gốc trong logic bộ nhớ đệm.'],
  ['Debug & chất lượng', 'stack trace', 'n', 'dấu vết ngăn xếp khi chương trình lỗi', 'The stack trace points to the payment module.', 'Dấu vết ngăn xếp trỏ tới mô-đun thanh toán.'],
  ['Debug & chất lượng', 'unit test', 'n', 'kiểm thử đơn vị', 'Add a unit test for this function.', 'Hãy thêm kiểm thử đơn vị cho hàm này.'],
  ['Debug & chất lượng', 'regression', 'n', 'lỗi cũ xuất hiện lại sau thay đổi', 'The automated test prevents this regression.', 'Kiểm thử tự động ngăn lỗi này xuất hiện trở lại.'],
  ['Debug & chất lượng', 'workaround', 'n', 'giải pháp tạm thời', 'We have a workaround while the permanent fix is being developed.', 'Chúng ta có giải pháp tạm thời trong khi bản sửa lâu dài đang được phát triển.'],
  ['Debug & chất lượng', 'refactor', 'v', 'tái cấu trúc mã mà không đổi hành vi', 'We refactored the module to make it easier to maintain.', 'Chúng tôi tái cấu trúc mô-đun để dễ bảo trì hơn.'],

  // 8. Agile and project communication
  ['Agile & dự án', 'requirement', 'n', 'yêu cầu của sản phẩm hoặc hệ thống', 'This requirement is not clear enough to implement.', 'Yêu cầu này chưa đủ rõ để triển khai.'],
  ['Agile & dự án', 'scope', 'n', 'phạm vi công việc', 'Adding payment is outside the scope of this task.', 'Việc thêm thanh toán nằm ngoài phạm vi nhiệm vụ này.'],
  ['Agile & dự án', 'backlog', 'n', 'danh sách công việc cần thực hiện', 'The product owner added the request to the backlog.', 'Product owner đã thêm yêu cầu vào backlog.'],
  ['Agile & dự án', 'sprint', 'n', 'chu kỳ phát triển ngắn', 'The team plans to finish the feature in this sprint.', 'Nhóm dự định hoàn thành tính năng trong sprint này.'],
  ['Agile & dự án', 'ticket', 'n', 'phiếu công việc hoặc lỗi cần xử lý', 'Please include the error message in the ticket.', 'Vui lòng ghi thông báo lỗi vào ticket.'],
  ['Agile & dự án', 'estimate', 'v/n', 'ước lượng; bản ước lượng', 'I estimate that the task will take two days.', 'Tôi ước lượng nhiệm vụ sẽ mất hai ngày.'],
  ['Agile & dự án', 'blocker', 'n', 'vấn đề đang cản trở tiến độ', 'Waiting for API access is our main blocker.', 'Việc chờ quyền truy cập API là trở ngại chính của chúng ta.'],
  ['Agile & dự án', 'stakeholder', 'n', 'bên liên quan', 'We will demonstrate the feature to the stakeholders.', 'Chúng ta sẽ trình diễn tính năng cho các bên liên quan.'],

  // 9. Career switching and interviews
  ['Chuyển ngành & phỏng vấn', 'transferable skills', 'n', 'kỹ năng có thể chuyển đổi giữa các ngành', 'Communication and problem-solving are transferable skills.', 'Giao tiếp và giải quyết vấn đề là những kỹ năng có thể chuyển đổi giữa các ngành.'],
  ['Chuyển ngành & phỏng vấn', 'entry-level position', 'n', 'vị trí dành cho người mới vào nghề', 'I am applying for an entry-level developer position.', 'Tôi đang ứng tuyển vị trí lập trình viên mới vào nghề.'],
  ['Chuyển ngành & phỏng vấn', 'portfolio', 'n', 'hồ sơ các dự án và sản phẩm đã làm', 'My portfolio includes three web applications.', 'Portfolio của tôi gồm ba ứng dụng web.'],
  ['Chuyển ngành & phỏng vấn', 'technical interview', 'n', 'phỏng vấn kỹ thuật', 'The technical interview included a debugging exercise.', 'Buổi phỏng vấn kỹ thuật có một bài tập tìm lỗi.'],
  ['Chuyển ngành & phỏng vấn', 'behavioral interview', 'n', 'phỏng vấn đánh giá hành vi và kinh nghiệm', 'Prepare specific stories for the behavioral interview.', 'Hãy chuẩn bị những câu chuyện cụ thể cho buổi phỏng vấn hành vi.'],
  ['Chuyển ngành & phỏng vấn', 'take-home assignment', 'n', 'bài tập tuyển dụng làm tại nhà', 'I submitted the take-home assignment before the deadline.', 'Tôi đã nộp bài tập tuyển dụng trước hạn.'],
  ['Chuyển ngành & phỏng vấn', 'onboarding', 'n', 'quá trình tiếp nhận nhân viên mới', 'The onboarding process starts next Monday.', 'Quá trình tiếp nhận nhân viên mới bắt đầu vào thứ Hai tới.'],
  ['Chuyển ngành & phỏng vấn', 'career path', 'n', 'lộ trình nghề nghiệp', 'I chose web development as my new career path.', 'Tôi chọn phát triển web làm lộ trình nghề nghiệp mới.'],
];

export const itCareerVocabulary = entries.map(([category, word, pos, meaning, example, exampleVi], index) => ({
  id: `it-${index + 1}`,
  category,
  word,
  pos,
  meaning,
  example,
  exampleVi,
}));

export const itWorkPhrases = [
  ['Daily stand-up', 'Yesterday I finished the login flow. Today I will work on validation.', 'Hôm qua tôi hoàn thành luồng đăng nhập. Hôm nay tôi sẽ làm phần kiểm tra dữ liệu.'],
  ['Báo blocker', 'I am blocked because I do not have access to the test server.', 'Tôi đang bị chặn vì chưa có quyền truy cập máy chủ kiểm thử.'],
  ['Hỏi lại yêu cầu', 'Could you clarify the expected behavior in this case?', 'Bạn có thể làm rõ hành vi mong đợi trong trường hợp này không?'],
  ['Xin thêm ngữ cảnh', 'Could you share the steps to reproduce the issue?', 'Bạn có thể chia sẻ các bước để tái hiện vấn đề không?'],
  ['Ước lượng', 'I need to review the existing code before I can give a reliable estimate.', 'Tôi cần xem mã hiện tại trước khi đưa ra ước lượng đáng tin cậy.'],
  ['Code review', 'I left a suggestion on the pull request. It is not a blocker.', 'Tôi đã để lại một gợi ý trong pull request. Đây không phải vấn đề chặn merge.'],
  ['Thừa nhận chưa biết', 'I have not used this tool before, but I can learn it and ask for guidance.', 'Tôi chưa dùng công cụ này trước đây, nhưng tôi có thể học và xin hướng dẫn.'],
  ['Xác nhận cách hiểu', 'Let me confirm that I understand the requirement correctly.', 'Để tôi xác nhận rằng mình đã hiểu đúng yêu cầu.'],
  ['Báo hoàn thành', 'The fix is ready for review and all automated tests pass.', 'Bản sửa đã sẵn sàng để duyệt và toàn bộ kiểm thử tự động đều đạt.'],
  ['Phỏng vấn chuyển ngành', 'My previous experience taught me how to communicate with customers and solve problems under pressure.', 'Kinh nghiệm trước đây giúp tôi biết cách giao tiếp với khách hàng và giải quyết vấn đề dưới áp lực.'],
  ['Nói về dự án', 'I built this project to practice working with APIs, authentication, and responsive design.', 'Tôi xây dựng dự án này để luyện làm việc với API, xác thực và thiết kế responsive.'],
  ['Khi chưa rõ câu hỏi', 'Could you rephrase the question or give me a small example?', 'Bạn có thể diễn đạt lại câu hỏi hoặc cho tôi một ví dụ nhỏ không?'],
].map(([situation, en, vi], index) => ({ id: `it-phrase-${index + 1}`, situation, en, vi }));

export const itCareerCategories = [...new Set(itCareerVocabulary.map((item) => item.category))];

package com.lingogoc.app

import android.Manifest
import android.annotation.SuppressLint
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewClientCompat
import org.json.JSONObject
import java.util.Locale

class MainActivity : ComponentActivity() {
    private lateinit var webView: WebView
    private lateinit var nativeBridge: NativeBridge
    private var pendingWebPermission: PermissionRequest? = null
    private var pendingNativeRecognition: Pair<String, String>? = null
    private var fileChooserCallback: ValueCallback<Array<Uri>>? = null
    private var pendingBackupContent: String? = null

    private val microphonePermission = registerForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted ->
        val nativeRecognition = pendingNativeRecognition
        pendingNativeRecognition = null
        if (nativeRecognition != null) {
            if (granted) {
                nativeBridge.startListeningWithPermission(nativeRecognition.first, nativeRecognition.second)
            } else {
                nativeBridge.notifyRecognition(nativeRecognition.first, "error", "", "not-allowed")
                nativeBridge.notifyRecognition(nativeRecognition.first, "end")
                Toast.makeText(this, "Cần quyền micro để luyện phát âm.", Toast.LENGTH_SHORT).show()
            }
            return@registerForActivityResult
        }

        val request = pendingWebPermission
        pendingWebPermission = null
        if (granted) {
            request?.grant(arrayOf(PermissionRequest.RESOURCE_AUDIO_CAPTURE))
        } else {
            request?.deny()
            Toast.makeText(this, "Cần quyền micro để luyện phát âm.", Toast.LENGTH_SHORT).show()
        }
    }

    private val filePicker = registerForActivityResult(
        ActivityResultContracts.GetContent(),
    ) { uri ->
        fileChooserCallback?.onReceiveValue(uri?.let { arrayOf(it) })
        fileChooserCallback = null
    }

    private val backupSaver = registerForActivityResult(
        ActivityResultContracts.CreateDocument("application/json"),
    ) { uri ->
        val content = pendingBackupContent
        pendingBackupContent = null
        if (uri == null || content == null) return@registerForActivityResult

        runCatching {
            contentResolver.openOutputStream(uri)?.bufferedWriter(Charsets.UTF_8)?.use { writer ->
                writer.write(content)
            } ?: error("Không mở được tệp đích")
        }.onSuccess {
            Toast.makeText(this, "Đã lưu bản sao dữ liệu.", Toast.LENGTH_SHORT).show()
        }.onFailure {
            Toast.makeText(this, "Không thể lưu bản sao dữ liệu.", Toast.LENGTH_SHORT).show()
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        window.statusBarColor = Color.rgb(15, 23, 42)
        window.navigationBarColor = Color.rgb(15, 23, 42)

        webView = WebView(this)
        setContentView(webView)

        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            allowFileAccess = false
            allowContentAccess = true
            mediaPlaybackRequiresUserGesture = false
            setSupportMultipleWindows(false)
            userAgentString = "$userAgentString LingoGocAndroid/1.0"
        }

        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        nativeBridge = NativeBridge()
        webView.addJavascriptInterface(nativeBridge, "LingoGocNative")

        webView.webViewClient = object : WebViewClientCompat() {
            override fun shouldInterceptRequest(
                view: WebView,
                request: WebResourceRequest,
            ): WebResourceResponse? = assetLoader.shouldInterceptRequest(request.url)

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val uri = request.url
                if (uri.host == APP_HOST) return false
                if (uri.scheme == "http" || uri.scheme == "https") {
                    startActivity(Intent(Intent.ACTION_VIEW, uri))
                    return true
                }
                return false
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest) {
                runOnUiThread {
                    if (!request.resources.contains(PermissionRequest.RESOURCE_AUDIO_CAPTURE)) {
                        request.deny()
                        return@runOnUiThread
                    }

                    if (ContextCompat.checkSelfPermission(
                            this@MainActivity,
                            Manifest.permission.RECORD_AUDIO,
                        ) == PackageManager.PERMISSION_GRANTED
                    ) {
                        request.grant(arrayOf(PermissionRequest.RESOURCE_AUDIO_CAPTURE))
                    } else {
                        pendingWebPermission?.deny()
                        pendingWebPermission = request
                        microphonePermission.launch(Manifest.permission.RECORD_AUDIO)
                    }
                }
            }

            override fun onPermissionRequestCanceled(request: PermissionRequest) {
                if (pendingWebPermission == request) pendingWebPermission = null
            }

            override fun onShowFileChooser(
                webView: WebView,
                filePathCallback: ValueCallback<Array<Uri>>,
                fileChooserParams: FileChooserParams,
            ): Boolean {
                fileChooserCallback?.onReceiveValue(null)
                fileChooserCallback = filePathCallback
                filePicker.launch("application/json")
                return true
            }
        }

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) webView.goBack() else finish()
            }
        })

        if (savedInstanceState == null) {
            webView.loadUrl(APP_URL)
        } else {
            webView.restoreState(savedInstanceState)
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        webView.saveState(outState)
        super.onSaveInstanceState(outState)
    }

    override fun onDestroy() {
        pendingWebPermission?.deny()
        fileChooserCallback?.onReceiveValue(null)
        nativeBridge.destroy()
        webView.removeJavascriptInterface("LingoGocNative")
        webView.destroy()
        super.onDestroy()
    }

    private fun requestBackup(fileName: String, content: String) {
        pendingBackupContent = content
        val safeName = fileName.replace(Regex("[^a-zA-Z0-9._-]"), "_")
            .ifBlank { "lingogoc_backup.json" }
        backupSaver.launch(safeName)
    }

    private fun requestNativeRecognition(requestId: String, language: String) {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
            nativeBridge.startListeningWithPermission(requestId, language)
            return
        }
        pendingNativeRecognition = requestId to language
        microphonePermission.launch(Manifest.permission.RECORD_AUDIO)
    }

    inner class NativeBridge : TextToSpeech.OnInitListener, RecognitionListener {
        private val textToSpeech = TextToSpeech(this@MainActivity, this)
        private var speechRecognizer: SpeechRecognizer? = null
        private var activeRecognitionId: String? = null

        @Volatile
        private var speechReady = false

        init {
            textToSpeech.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                override fun onStart(utteranceId: String) = notifySpeech(utteranceId, "start")
                override fun onDone(utteranceId: String) = notifySpeech(utteranceId, "done")
                @Deprecated("Deprecated in Java")
                override fun onError(utteranceId: String) = notifySpeech(utteranceId, "error")
                override fun onError(utteranceId: String, errorCode: Int) = notifySpeech(utteranceId, "error")
            })
        }

        override fun onInit(status: Int) {
            speechReady = status == TextToSpeech.SUCCESS
        }

        @JavascriptInterface
        fun speak(text: String, language: String, rate: Double, pitch: Double, requestId: String): Boolean {
            if (!speechReady || text.isBlank()) return false
            runOnUiThread {
                textToSpeech.language = Locale.forLanguageTag(language.replace('_', '-'))
                textToSpeech.setSpeechRate(rate.toFloat().coerceIn(0.5f, 2f))
                textToSpeech.setPitch(pitch.toFloat().coerceIn(0.5f, 2f))
                val result = textToSpeech.speak(text, TextToSpeech.QUEUE_FLUSH, null, requestId)
                if (result == TextToSpeech.ERROR) notifySpeech(requestId, "error")
            }
            return true
        }

        @JavascriptInterface
        fun stopSpeech() {
            runOnUiThread { textToSpeech.stop() }
        }

        @JavascriptInterface
        fun startListening(requestId: String, language: String) {
            runOnUiThread { requestNativeRecognition(requestId, language) }
        }

        @JavascriptInterface
        fun stopListening(requestId: String) {
            runOnUiThread {
                if (activeRecognitionId != requestId) return@runOnUiThread
                speechRecognizer?.cancel()
                activeRecognitionId = null
                notifyRecognition(requestId, "end")
            }
        }

        @JavascriptInterface
        fun saveBackup(fileName: String, content: String) {
            runOnUiThread { requestBackup(fileName, content) }
        }

        private fun notifySpeech(requestId: String, status: String) {
            val safeId = JSONObject.quote(requestId)
            val safeStatus = JSONObject.quote(status)
            webView.post {
                webView.evaluateJavascript(
                    "if(window.__lingogocNativeSpeechEvent){window.__lingogocNativeSpeechEvent($safeId,$safeStatus);}",
                    null,
                )
            }
        }

        fun startListeningWithPermission(requestId: String, language: String) {
            if (!SpeechRecognizer.isRecognitionAvailable(this@MainActivity)) {
                notifyRecognition(requestId, "error", "", "service-not-allowed")
                notifyRecognition(requestId, "end")
                return
            }
            if (speechRecognizer == null) {
                speechRecognizer = SpeechRecognizer.createSpeechRecognizer(this@MainActivity).also {
                    it.setRecognitionListener(this)
                }
            }
            activeRecognitionId = requestId
            val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                putExtra(RecognizerIntent.EXTRA_LANGUAGE, language)
                putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
                putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
            }
            speechRecognizer?.startListening(intent)
        }

        fun notifyRecognition(
            requestId: String,
            status: String,
            transcript: String = "",
            error: String = "",
        ) {
            val safeId = JSONObject.quote(requestId)
            val safeStatus = JSONObject.quote(status)
            val safeTranscript = JSONObject.quote(transcript)
            val safeError = JSONObject.quote(error)
            webView.post {
                webView.evaluateJavascript(
                    "if(window.__lingogocNativeRecognitionEvent){window.__lingogocNativeRecognitionEvent($safeId,$safeStatus,$safeTranscript,$safeError);}",
                    null,
                )
            }
        }

        private fun recognitionText(results: Bundle?): String =
            results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull().orEmpty()

        override fun onReadyForSpeech(params: Bundle?) = Unit
        override fun onBeginningOfSpeech() = Unit
        override fun onRmsChanged(rmsdB: Float) = Unit
        override fun onBufferReceived(buffer: ByteArray?) = Unit
        override fun onEndOfSpeech() = Unit

        override fun onError(error: Int) {
            val requestId = activeRecognitionId ?: return
            activeRecognitionId = null
            val code = when (error) {
                SpeechRecognizer.ERROR_AUDIO -> "audio-capture"
                SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "not-allowed"
                SpeechRecognizer.ERROR_NETWORK, SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "network"
                SpeechRecognizer.ERROR_NO_MATCH -> "no-speech"
                SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "aborted"
                else -> "recognition-error"
            }
            notifyRecognition(requestId, "error", "", code)
            notifyRecognition(requestId, "end")
        }

        override fun onResults(results: Bundle?) {
            val requestId = activeRecognitionId ?: return
            activeRecognitionId = null
            notifyRecognition(requestId, "final", recognitionText(results))
            notifyRecognition(requestId, "end")
        }

        override fun onPartialResults(partialResults: Bundle?) {
            val requestId = activeRecognitionId ?: return
            notifyRecognition(requestId, "partial", recognitionText(partialResults))
        }

        override fun onEvent(eventType: Int, params: Bundle?) = Unit

        fun destroy() {
            speechRecognizer?.cancel()
            speechRecognizer?.destroy()
            textToSpeech.stop()
            textToSpeech.shutdown()
        }
    }

    companion object {
        private const val APP_HOST = "appassets.androidplatform.net"
        private const val APP_URL = "https://appassets.androidplatform.net/assets/web/index.html"
    }
}

package com.lingogoc.app

import android.Manifest
import android.annotation.SuppressLint
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
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
    private var activityStarted = false
    private lateinit var connectivityManager: ConnectivityManager
    private var networkCallbackRegistered = false

    private val networkCallback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) = notifyNetworkState()
        override fun onLost(network: Network) = notifyNetworkState()
        override fun onCapabilitiesChanged(network: Network, capabilities: NetworkCapabilities) = notifyNetworkState()
    }

    private val microphonePermission = registerForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted ->
        val nativeRecognition = pendingNativeRecognition
        pendingNativeRecognition = null
        if (nativeRecognition != null) {
            if (granted && activityStarted) {
                nativeBridge.startListeningWithPermission(nativeRecognition.first, nativeRecognition.second)
            } else {
                val error = if (granted) "aborted" else "not-allowed"
                nativeBridge.notifyRecognition(nativeRecognition.first, "error", "", error)
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
        connectivityManager = getSystemService(ConnectivityManager::class.java)

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

        runCatching {
            connectivityManager.registerDefaultNetworkCallback(networkCallback)
            networkCallbackRegistered = true
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        webView.saveState(outState)
        super.onSaveInstanceState(outState)
    }

    override fun onStart() {
        super.onStart()
        activityStarted = true
    }

    override fun onStop() {
        activityStarted = false
        if (::nativeBridge.isInitialized) nativeBridge.stopForLifecycle()
        super.onStop()
    }

    override fun onDestroy() {
        if (networkCallbackRegistered) {
            runCatching { connectivityManager.unregisterNetworkCallback(networkCallback) }
            networkCallbackRegistered = false
        }
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

    private fun currentNetworkState(): String {
        val network = connectivityManager.activeNetwork ?: return "offline"
        val capabilities = connectivityManager.getNetworkCapabilities(network) ?: return "offline"
        return when {
            capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED) -> "online"
            capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) -> "limited"
            else -> "offline"
        }
    }

    private fun notifyNetworkState() {
        if (!::webView.isInitialized) return
        val state = JSONObject.quote(currentNetworkState())
        webView.post {
            webView.evaluateJavascript(
                "if(window.__lingogocNativeNetworkEvent){window.__lingogocNativeNetworkEvent($state);}",
                null,
            )
        }
    }

    inner class NativeBridge : TextToSpeech.OnInitListener, RecognitionListener {
        private val textToSpeech = TextToSpeech(this@MainActivity, this)
        private val audioManager = getSystemService(AudioManager::class.java)
        private var speechRecognizer: SpeechRecognizer? = null
        private var activeRecognitionId: String? = null
        private var activeSpeechId: String? = null
        private val audioFocusRequest = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
            .setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ASSISTANCE_ACCESSIBILITY)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build(),
            )
            .setOnAudioFocusChangeListener { change ->
                if (
                    change == AudioManager.AUDIOFOCUS_LOSS ||
                    change == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT ||
                    change == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK
                ) {
                    runOnUiThread { interruptSpeech() }
                }
            }
            .build()

        @Volatile
        private var speechReady = false

        init {
            textToSpeech.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                override fun onStart(utteranceId: String) = notifySpeech(utteranceId, "start")
                override fun onDone(utteranceId: String) = finishSpeech(utteranceId, "done")
                @Deprecated("Deprecated in Java")
                override fun onError(utteranceId: String) = finishSpeech(utteranceId, "error")
                override fun onError(utteranceId: String, errorCode: Int) = finishSpeech(utteranceId, "error")
            })
        }

        override fun onInit(status: Int) {
            speechReady = status == TextToSpeech.SUCCESS
        }

        @JavascriptInterface
        fun speak(text: String, language: String, rate: Double, pitch: Double, requestId: String): Boolean {
            if (!speechReady || text.isBlank()) return false
            runOnUiThread {
                val languageResult = textToSpeech.setLanguage(Locale.forLanguageTag(language.replace('_', '-')))
                if (languageResult == TextToSpeech.LANG_MISSING_DATA || languageResult == TextToSpeech.LANG_NOT_SUPPORTED) {
                    notifySpeech(requestId, "error")
                    return@runOnUiThread
                }
                if (audioManager.requestAudioFocus(audioFocusRequest) != AudioManager.AUDIOFOCUS_REQUEST_GRANTED) {
                    notifySpeech(requestId, "error")
                    return@runOnUiThread
                }
                textToSpeech.setSpeechRate(rate.toFloat().coerceIn(0.5f, 2f))
                textToSpeech.setPitch(pitch.toFloat().coerceIn(0.5f, 2f))
                activeSpeechId = requestId
                val result = textToSpeech.speak(text, TextToSpeech.QUEUE_FLUSH, null, requestId)
                if (result == TextToSpeech.ERROR) finishSpeech(requestId, "error")
            }
            return true
        }

        @JavascriptInterface
        fun stopSpeech() {
            runOnUiThread { interruptSpeech(notifyWeb = false) }
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

        @JavascriptInterface
        fun getNetworkState(): String = currentNetworkState()

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
            if (activeRecognitionId != null) {
                notifyRecognition(requestId, "error", "", "recognizer-busy")
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

        private fun finishSpeech(requestId: String, status: String) {
            if (activeSpeechId == requestId) {
                activeSpeechId = null
                audioManager.abandonAudioFocusRequest(audioFocusRequest)
            }
            notifySpeech(requestId, status)
        }

        private fun interruptSpeech(notifyWeb: Boolean = true) {
            val requestId = activeSpeechId
            activeSpeechId = null
            textToSpeech.stop()
            audioManager.abandonAudioFocusRequest(audioFocusRequest)
            if (notifyWeb && requestId != null) notifySpeech(requestId, "cancelled")
        }

        fun stopForLifecycle() {
            interruptSpeech()
            val requestId = activeRecognitionId
            activeRecognitionId = null
            speechRecognizer?.cancel()
            if (requestId != null) {
                notifyRecognition(requestId, "error", "", "aborted")
                notifyRecognition(requestId, "end")
            }
        }

        fun destroy() {
            stopForLifecycle()
            speechRecognizer?.destroy()
            textToSpeech.shutdown()
        }
    }

    companion object {
        private const val APP_HOST = "appassets.androidplatform.net"
        private const val APP_URL = "https://appassets.androidplatform.net/assets/web/index.html"
    }
}

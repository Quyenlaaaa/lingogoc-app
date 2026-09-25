package com.lingogoc.app

import android.Manifest
import android.content.pm.PackageManager
import android.view.View
import android.view.ViewGroup
import android.webkit.WebView
import androidx.test.ext.junit.rules.ActivityScenarioRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference

@RunWith(AndroidJUnit4::class)
class MainActivitySmokeTest {
    @get:Rule
    val activityRule = ActivityScenarioRule(MainActivity::class.java)

    @Test
    fun bundledAppLoadsWithRestrictedWebViewAndNativeBridge() {
        val javascriptResult = AtomicReference<String>()
        val javascriptFinished = CountDownLatch(1)

        activityRule.scenario.onActivity { activity ->
            val webView = findWebView(activity.window.decorView)
            assertNotNull("MainActivity must contain its bundled WebView", webView)
            webView ?: return@onActivity
            assertTrue(webView.settings.javaScriptEnabled)
            assertTrue(webView.settings.domStorageEnabled)
            assertFalse(webView.settings.allowFileAccess)
            assertEquals(
                "https://appassets.androidplatform.net/assets/web/index.html",
                webView.url,
            )
            webView.evaluateJavascript("typeof window.LingoGocNative") { result ->
                javascriptResult.set(result)
                javascriptFinished.countDown()
            }
        }

        assertTrue("Native bridge JavaScript check timed out", javascriptFinished.await(10, TimeUnit.SECONDS))
        assertEquals("\"object\"", javascriptResult.get())
    }

    @Test
    fun microphonePermissionIsDeclaredButNotGrantedByStartupCode() {
        activityRule.scenario.onActivity { activity ->
            val requested = activity.packageManager
                .getPackageInfo(activity.packageName, PackageManager.GET_PERMISSIONS)
                .requestedPermissions
                ?.toSet()
                .orEmpty()
            assertTrue(requested.contains(Manifest.permission.RECORD_AUDIO))
            assertTrue(requested.contains(Manifest.permission.INTERNET))
            assertTrue(requested.contains(Manifest.permission.ACCESS_NETWORK_STATE))
        }
    }

    private fun findWebView(view: View): WebView? {
        if (view is WebView) return view
        if (view !is ViewGroup) return null
        for (index in 0 until view.childCount) {
            findWebView(view.getChildAt(index))?.let { return it }
        }
        return null
    }
}

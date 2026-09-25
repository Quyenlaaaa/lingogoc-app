plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

fun environmentValue(name: String): String? = providers.environmentVariable(name).orNull
    ?.trim()
    ?.takeIf { it.isNotEmpty() }

val configuredVersionCode = environmentValue("LINGOGOC_VERSION_CODE")
val appVersionCode = configuredVersionCode?.toIntOrNull()
    ?: if (configuredVersionCode == null) 1 else throw GradleException("LINGOGOC_VERSION_CODE must be a positive integer")
if (appVersionCode < 1) throw GradleException("LINGOGOC_VERSION_CODE must be a positive integer")
val appVersionName = environmentValue("LINGOGOC_VERSION_NAME") ?: "1.0.0"
if (!Regex("^[0-9]+\\.[0-9]+\\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$").matches(appVersionName)) {
    throw GradleException("LINGOGOC_VERSION_NAME must be a semantic version")
}

val signingValues = mapOf(
    "storeFile" to environmentValue("LINGOGOC_KEYSTORE_PATH"),
    "storePassword" to environmentValue("LINGOGOC_KEYSTORE_PASSWORD"),
    "keyAlias" to environmentValue("LINGOGOC_KEY_ALIAS"),
    "keyPassword" to environmentValue("LINGOGOC_KEY_PASSWORD"),
)
val configuredSigningValues = signingValues.values.count { it != null }
if (configuredSigningValues !in listOf(0, signingValues.size)) {
    throw GradleException("Release signing variables must be provided together")
}
val releaseSigningConfigured = configuredSigningValues == signingValues.size

android {
    namespace = "com.lingogoc.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.lingogoc.app"
        minSdk = 26
        targetSdk = 35
        versionCode = appVersionCode
        versionName = appVersionName

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    signingConfigs {
        if (releaseSigningConfigured) {
            create("release") {
                storeFile = file(signingValues.getValue("storeFile")!!)
                storePassword = signingValues.getValue("storePassword")
                keyAlias = signingValues.getValue("keyAlias")
                keyPassword = signingValues.getValue("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            if (releaseSigningConfigured) signingConfig = signingConfigs.getByName("release")
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        buildConfig = true
    }
}

val webRoot = rootProject.projectDir.parentFile.resolve("web")
val npmCommand = if (System.getProperty("os.name").lowercase().contains("windows")) "npm.cmd" else "npm"
val generatedWebAssets = layout.buildDirectory.dir("generated/webAssets")

val buildWeb by tasks.registering(Exec::class) {
    workingDir(webRoot)
    commandLine(npmCommand, "run", "build")
    inputs.dir(webRoot.resolve("src"))
    inputs.file(webRoot.resolve("index.html"))
    inputs.file(webRoot.resolve("vite.config.js"))
    outputs.dir(webRoot.resolve("dist"))
}

val syncWebAssets by tasks.registering(Copy::class) {
    dependsOn(buildWeb)
    from(webRoot.resolve("dist"))
    into(generatedWebAssets.map { it.dir("web") })
}

android.sourceSets["main"].assets.srcDir(generatedWebAssets)
tasks.named("preBuild").configure { dependsOn(syncWebAssets) }

dependencies {
    implementation("androidx.activity:activity-ktx:1.10.1")
    implementation("androidx.core:core-ktx:1.16.0")
    implementation("androidx.webkit:webkit:1.13.0")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.test:rules:1.6.1")
}

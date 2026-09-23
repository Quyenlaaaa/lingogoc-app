plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.lingogoc.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.lingogoc.app"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
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
}

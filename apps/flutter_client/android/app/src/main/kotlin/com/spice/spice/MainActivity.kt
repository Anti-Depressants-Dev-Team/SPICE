package com.spice.spice

import com.ryanheise.audioservice.AudioServiceActivity

// audio_service requires the host Activity to be AudioServiceActivity so the
// foreground media-playback service can hand the FlutterEngine back to the
// activity when the user reopens the app from the notification.
class MainActivity : AudioServiceActivity()

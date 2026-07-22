Fellowship soundscapes — ambient focus music
=============================================

Drop ambient .mp3 (or .ogg/.wav/.m4a/.flac) tracks here to bundle them with the
app as built-in soundscapes. Users can also add their own tracks at:

    %USERPROFILE%\.fellowship-focus\music\

The in-app player (Focus tab) auto-plays these during focus sessions, pauses on
breaks, and loops the playlist.

Royalty-free focus mixes (YouTube → local mp3) live in the user music folder.
Re-sync into this folder + web/public/audio with:

    powershell -ExecutionPolicy Bypass -File desktop/scripts/sync_focus_music.ps1

Large .mp3 files are gitignored — do not commit them.


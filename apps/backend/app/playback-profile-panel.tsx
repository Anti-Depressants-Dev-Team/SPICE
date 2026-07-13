'use client';

import {
  DEFAULT_PLAYBACK_PROFILE,
  MAX_PLAYBACK_PROFILES,
  normalizePlaybackProfileState,
  type PlaybackProfile,
  type PlaybackProfileState,
} from './playback-profiles';

interface PlaybackProfilePanelProps {
  state: PlaybackProfileState;
  onChange: (state: PlaybackProfileState) => void;
  onBuildSmartQueue: () => void;
  smartQueueActionDisabled?: boolean;
}

export default function PlaybackProfilePanel({
  state,
  onChange,
  onBuildSmartQueue,
  smartQueueActionDisabled = false,
}: PlaybackProfilePanelProps) {
  const active = state.profiles.find((profile) => profile.id === state.activeProfileId) ?? state.profiles[0];

  const updateActive = (updater: (profile: PlaybackProfile) => PlaybackProfile) => {
    onChange(normalizePlaybackProfileState({
      ...state,
      profiles: state.profiles.map((profile) => profile.id === active.id ? updater(profile) : profile),
    }));
  };

  return (
    <div className="playback-profile-panel">
      <div className="playback-profile-panel__toolbar">
        <label>
          Active playback profile
          <select
            value={active.id}
            onChange={(event) => onChange({ ...state, activeProfileId: event.target.value })}
          >
            {state.profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
          </select>
        </label>
        <button
          type="button"
          className="btn btn--ghost"
          disabled={state.profiles.length >= MAX_PLAYBACK_PROFILES}
          onClick={() => {
            const suffix = Date.now().toString(36);
            const created: PlaybackProfile = {
              ...DEFAULT_PLAYBACK_PROFILE,
              id: `profile-${suffix}`,
              name: `Profile ${state.profiles.length + 1}`,
              crossfade: { ...active.crossfade },
              smartQueue: { ...active.smartQueue },
            };
            onChange(normalizePlaybackProfileState({ ...state, activeProfileId: created.id, profiles: [...state.profiles, created] }));
          }}
        >
          Duplicate profile
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          disabled={state.profiles.length <= 1}
          onClick={() => onChange(normalizePlaybackProfileState({
            ...state,
            activeProfileId: state.profiles.find((profile) => profile.id !== active.id)?.id,
            profiles: state.profiles.filter((profile) => profile.id !== active.id),
          }))}
        >
          Delete
        </button>
      </div>

      <label className="playback-profile-panel__name">
        Profile name
        <input value={active.name} maxLength={48} onChange={(event) => updateActive((profile) => ({ ...profile, name: event.target.value }))} />
      </label>

      <div className="playback-profile-panel__features">
        <section>
          <label className="playback-profile-panel__switch">
            <input
              type="checkbox"
              checked={active.crossfade.enabled}
              onChange={(event) => updateActive((profile) => ({
                ...profile,
                crossfade: {
                  ...profile.crossfade,
                  enabled: event.target.checked,
                  durationMs: event.target.checked ? Math.max(500, profile.crossfade.durationMs) : profile.crossfade.durationMs,
                },
              }))}
            />
            Crossfade transitions
          </label>
          <p>Fade between direct-audio tracks without changing queue order.</p>
          <label>
            Duration: {(active.crossfade.durationMs / 1000).toFixed(1)}s
            <input
              type="range"
              min="500"
              max="12000"
              step="500"
              value={active.crossfade.durationMs}
              disabled={!active.crossfade.enabled}
              onChange={(event) => updateActive((profile) => ({
                ...profile,
                crossfade: { ...profile.crossfade, durationMs: Number(event.target.value) },
              }))}
            />
          </label>
          <label>
            Fade curve
            <select
              value={active.crossfade.curve}
              disabled={!active.crossfade.enabled}
              onChange={(event) => updateActive((profile) => ({
                ...profile,
                crossfade: { ...profile.crossfade, curve: event.target.value === 'linear' ? 'linear' : 'equal-power' },
              }))}
            >
              <option value="equal-power">Equal power</option>
              <option value="linear">Linear</option>
            </select>
          </label>
        </section>

        <section>
          <label className="playback-profile-panel__switch">
            <input
              type="checkbox"
              checked={active.smartQueue.enabled}
              onChange={(event) => updateActive((profile) => ({
                ...profile,
                smartQueue: { ...profile.smartQueue, enabled: event.target.checked },
              }))}
            />
            Smart queue rules
          </label>
          <p>Avoid recent repeats and rotate artists and sources while favoring likes.</p>
          <label>
            Recent tracks to avoid: {active.smartQueue.recentTrackWindow}
            <input
              type="range"
              min="0"
              max="100"
              value={active.smartQueue.recentTrackWindow}
              disabled={!active.smartQueue.enabled}
              onChange={(event) => updateActive((profile) => ({
                ...profile,
                smartQueue: { ...profile.smartQueue, recentTrackWindow: Number(event.target.value) },
              }))}
            />
          </label>
          <label>
            Recent artists to reduce: {active.smartQueue.recentArtistWindow}
            <input
              type="range"
              min="0"
              max="50"
              value={active.smartQueue.recentArtistWindow}
              disabled={!active.smartQueue.enabled}
              onChange={(event) => updateActive((profile) => ({
                ...profile,
                smartQueue: { ...profile.smartQueue, recentArtistWindow: Number(event.target.value) },
              }))}
            />
          </label>
          <label>
            Liked-track boost: {active.smartQueue.likedBoost}
            <input
              type="range"
              min="0"
              max="100"
              value={active.smartQueue.likedBoost}
              disabled={!active.smartQueue.enabled}
              onChange={(event) => updateActive((profile) => ({ ...profile, smartQueue: { ...profile.smartQueue, likedBoost: Number(event.target.value) } }))}
            />
          </label>
          <label>
            Recent-artist penalty: {active.smartQueue.recentArtistPenalty}
            <input
              type="range"
              min="0"
              max="100"
              value={active.smartQueue.recentArtistPenalty}
              disabled={!active.smartQueue.enabled}
              onChange={(event) => updateActive((profile) => ({ ...profile, smartQueue: { ...profile.smartQueue, recentArtistPenalty: Number(event.target.value) } }))}
            />
          </label>
          <label>
            Source repetition penalty: {active.smartQueue.sourceDiversityPenalty}
            <input
              type="range"
              min="0"
              max="100"
              value={active.smartQueue.sourceDiversityPenalty}
              disabled={!active.smartQueue.enabled}
              onChange={(event) => updateActive((profile) => ({ ...profile, smartQueue: { ...profile.smartQueue, sourceDiversityPenalty: Number(event.target.value) } }))}
            />
          </label>
          <label>
            Artist repetition penalty: {active.smartQueue.artistDiversityPenalty}
            <input
              type="range"
              min="0"
              max="100"
              value={active.smartQueue.artistDiversityPenalty}
              disabled={!active.smartQueue.enabled}
              onChange={(event) => updateActive((profile) => ({ ...profile, smartQueue: { ...profile.smartQueue, artistDiversityPenalty: Number(event.target.value) } }))}
            />
          </label>
          <button type="button" className="btn btn--primary" disabled={!active.smartQueue.enabled || smartQueueActionDisabled} onClick={onBuildSmartQueue}>
            Rebuild current queue
          </button>
        </section>
      </div>
    </div>
  );
}

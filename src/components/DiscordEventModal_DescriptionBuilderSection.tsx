import React from "react";

interface DescriptionBuilderSectionProps {
  recapPageIds: string[];
  setRecapPageIds: React.Dispatch<React.SetStateAction<string[]>>;
  availablePages: any[];
  webclientUrl: string;
  setWebclientUrl: (value: string) => void;
  channels: Array<{ id: string; name: string }>;
  channel: string;
  setChannel: (value: string) => void;
  voiceChannels: Array<{ id: string; name: string }>;
  voiceChannel: string;
  setVoiceChannel: (value: string) => void;
  isLoadingChannels: boolean;
  dropdownOpen: boolean;
  setDropdownOpen: (value: boolean) => void;
  voiceDropdownOpen: boolean;
  setVoiceDropdownOpen: (value: boolean) => void;
  onPagePickerOpen?: () => void;
}

const DescriptionBuilderSection: React.FC<DescriptionBuilderSectionProps> = ({
  recapPageIds,
  setRecapPageIds,
  availablePages,
  webclientUrl,
  setWebclientUrl,
  channels,
  channel,
  setChannel,
  voiceChannels,
  voiceChannel,
  setVoiceChannel,
  isLoadingChannels,
  dropdownOpen,
  setDropdownOpen,
  voiceDropdownOpen,
  setVoiceDropdownOpen,
  onPagePickerOpen,
}) => {
  const selectedChannel = channels.find((ch) => ch.id === channel);
  const toggleRecapPage = (pageId: string) => {
    setRecapPageIds((prev: string[]) =>
      prev.includes(pageId)
        ? prev.filter((id) => id !== pageId)
        : [...prev, pageId],
    );
  };

  return (
    <div className="modal__column modal__column--right">
      {/* Description Builder */}
      <div className="form-group">
        <label className="form-label">Event Description</label>

        {/* RECAP Section */}
        <div style={{ marginBottom: "1rem" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              marginBottom: "0.5rem",
            }}
          >
            <span
              style={{
                fontSize: "0.85rem",
                color: "#94a3b8",
              }}
            >
              RECAP:
            </span>
            <button
              type="button"
              className="btn-text-small"
              onClick={onPagePickerOpen}
              style={{
                background: "none",
                border: "none",
                color: "#e6c896",
                cursor: "pointer",
                fontSize: "0.8rem",
                textDecoration: "underline",
              }}
            >
              {recapPageIds.length === 0
                ? "Add Campaign Pages"
                : `${recapPageIds.length} page(s) selected`}
            </button>
          </div>
          {recapPageIds.length > 0 && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "0.5rem",
              }}
            >
              {recapPageIds.map((pageId) => {
                const page = availablePages.find((p: any) => p._id === pageId);
                return page ? (
                  <div
                    key={pageId}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.25rem",
                      background: "rgb(153, 126, 67)",
                      padding: "0.25rem 0.5rem",
                      borderRadius: "4px",
                      fontSize: "0.8rem",
                      color: "#cbd5e1",
                    }}
                  >
                    <span>{page.title}</span>
                    <button
                      type="button"
                      onClick={() => toggleRecapPage(pageId)}
                      aria-label="Remove"
                      style={{
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        color: "#94a3b8",
                        padding: "0",
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      ×
                    </button>
                  </div>
                ) : null;
              })}
            </div>
          )}
        </div>

        {/* WEBCLIENT Section */}
        <div style={{ marginBottom: "1rem" }}>
          <div
            style={{
              marginBottom: "0.5rem",
              fontSize: "0.85rem",
              color: "#94a3b8",
            }}
          >
            WEBCLIENT:
          </div>
          <input
            type="text"
            value={webclientUrl}
            onChange={(e) => setWebclientUrl(e.target.value)}
            placeholder="Enter webclient URL..."
            className="modal__input"
          />
        </div>

        {/* Event Channel Dropdown */}
        <div className="form-group">
          <label className="form-label">Event Channel</label>
          <div
            className="custom-dropdown"
            style={{
              position: "relative",
              zIndex: 50,
            }}
          >
            <button
              type="button"
              className="dropdown-trigger"
              onClick={(e) => {
                setDropdownOpen(!dropdownOpen);
                // Set CSS var for max dropdown height based on viewport position
                const rect = e.currentTarget.getBoundingClientRect();
                document.documentElement.style.setProperty(
                  "--popup-top",
                  `${rect.bottom}px`,
                );
              }}
              disabled={isLoadingChannels}
            >
              {isLoadingChannels
                ? "Loading channels..."
                : selectedChannel
                  ? `# ${selectedChannel.name}`
                  : "Select a channel"}
              <span className="dropdown-arrow">▼</span>
            </button>
            {dropdownOpen && (
              <div className="dropdown-popup">
                {channels.map((ch) => (
                  <div
                    key={ch.id}
                    className="dropdown-item"
                    onClick={() => {
                      setChannel(ch.id);
                      setDropdownOpen(false);
                    }}
                  >
                    # {ch.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        {/* Voice Channel Dropdown */}
        <div className="form-group">
          <label className="form-label">Voice Channel (optional)</label>
          <div
            className="custom-dropdown"
            style={{
              position: "relative",
              zIndex: 49,
            }}
          >
            <button
              type="button"
              className="dropdown-trigger"
              onClick={(e) => {
                setVoiceDropdownOpen(!voiceDropdownOpen);
                const rect = e.currentTarget.getBoundingClientRect();
                document.documentElement.style.setProperty(
                  "--popup-top",
                  `${rect.bottom}px`,
                );
              }}
            >
              {voiceChannels.length === 0
                ? "No voice channels"
                : voiceChannel
                  ? `🔊 ${
                      voiceChannels.find((vc) => vc.id === voiceChannel)?.name
                    }`
                  : "Select a voice channel"}
              <span className="dropdown-arrow">▼</span>
            </button>
            {voiceDropdownOpen && voiceChannels.length > 0 && (
              <div className="dropdown-popup">
                <div
                  className="dropdown-item"
                  onClick={() => {
                    setVoiceChannel("");
                    setVoiceDropdownOpen(false);
                  }}
                >
                  None
                </div>
                {voiceChannels.map((vc) => (
                  <div
                    key={vc.id}
                    className="dropdown-item"
                    onClick={() => {
                      setVoiceChannel(vc.id);
                      setVoiceDropdownOpen(false);
                    }}
                  >
                    🔊 {vc.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DescriptionBuilderSection;

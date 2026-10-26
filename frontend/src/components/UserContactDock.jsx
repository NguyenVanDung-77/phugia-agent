
import "../styles/user-contact.css";

// SỐ LIÊN HỆ
const PHONE = "0931589777";

// EMAIL MINH HỌA:
// Thay bằng Gmail thật của dự án khi có.
const GMAIL = "phugiaroyalpark.demo@gmail.com";

function PhoneIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
    >
      <path
        d="M7.1 3.7 9.5 7.8 7.8 10c1.3 2.6 3.6 4.9 6.2 6.2l2.2-1.7 4.1 2.4-.8 3.2a2 2 0 0 1-2.1 1.5C9.3 20.8 3.2 14.7 2.5 6.6A2 2 0 0 1 4 4.5l3.1-.8Z"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
    >
      <rect
        x="2.5"
        y="5"
        width="19"
        height="14"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.7"
      />

      <path
        d="m3.5 7 8.5 6 8.5-6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function UserContactDock() {
  return (
    <aside
      className="uc-contact-dock"
      aria-label="Liên hệ tư vấn Phú Gia Royal Park"
    >
      {/* =============================
          1. ZALO
      ============================= */}
      <a
        className="uc-contact-button uc-zalo"
        href={`https://zalo.me/${PHONE}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Liên hệ Zalo ${PHONE}`}
        title={`Chat Zalo: ${PHONE}`}
      >
        <span
          className="uc-contact-symbol uc-zalo-symbol"
          aria-hidden="true"
        >
          Zalo
        </span>

        <span
          className="uc-contact-tooltip"
          aria-hidden="true"
        >
          Chat Zalo
        </span>
      </a>

      {/* =============================
          2. HOTLINE
      ============================= */}
      <a
        className="uc-contact-button uc-hotline"
        href={`tel:+84${PHONE.slice(1)}`}
        aria-label={`Gọi hotline ${PHONE}`}
        title={`Gọi ${PHONE}`}
      >
        <span
          className="uc-contact-symbol"
          aria-hidden="true"
        >
          <PhoneIcon />
        </span>

        <span
          className="uc-contact-tooltip"
          aria-hidden="true"
        >
          Hotline {PHONE}
        </span>
      </a>

      {/* =============================
          3. GMAIL
      ============================= */}
      <a
        className="uc-contact-button uc-gmail"
        href={
          `mailto:${GMAIL}?subject=` +
          encodeURIComponent(
            "Tư vấn Phú Gia Royal Park"
          )
        }
        aria-label="Gửi email tư vấn"
        title={`Gửi email: ${GMAIL}`}
      >
        <span
          className="uc-contact-symbol"
          aria-hidden="true"
        >
          <MailIcon />
        </span>

        <span
          className="uc-contact-tooltip"
          aria-hidden="true"
        >
          Gửi email
        </span>
      </a>
    </aside>
  );
}

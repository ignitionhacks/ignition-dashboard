import QRCode from 'react-qr-code';

const mapPinAsset = '/assets/icon-pin.svg';
const cloudEyesAsset = '/assets/Vector 196.svg';

const attendeeProfile = {
  name: 'Bobby Brown',
  status: 'Hacker',
  qrValue: 'IGNITION_SAMPLE_USER_ID_123',
};

const attendanceData = [
  { id: 1, date: 'May 16', eventName: 'Lunch', location: 'Main Auditorium', attended: true },
  { id: 2, date: 'May 16', eventName: 'Dinner', location: 'Main Auditorium', attended: false },
  { id: 3, date: 'May 17', eventName: 'Breakfast', location: 'Main Auditorium', attended: true },
  { id: 4, date: 'May 17', eventName: 'Lunch', location: 'Main Auditorium', attended: false },
  { id: 5, date: 'May 17', eventName: 'Dinner', location: 'Main Auditorium', attended: false },
  { id: 6, date: 'May 18', eventName: 'Breakfast', location: 'Main Auditorium', attended: true },
];

function ProfileHeader({ name, status }) {
  return (
    <header className="profile-header">
      <div>
        <h2 className="profile-name">{name}</h2>
        <p className="profile-status">
          <span>Status:</span> {status}
        </p>
      </div>
      <button type="button" className="submit-project-btn">
        <span aria-hidden="true">☆</span>
        Submit Project
      </button>
    </header>
  );
}

function ProfileBanner() {
  return (
    <div className="profile-banner" aria-hidden="true">
      <div className="banner-cloud" />
      <div className="banner-face">
        <img src={cloudEyesAsset} alt="" className="banner-cloud-eyes" />
      </div>
      <div className="banner-bubble">
        <span className="eye" />
        <span className="eye" />
      </div>
    </div>
  );
}

function AttendanceItem({ item }) {
  return (
    <article className="attendance-item">
      <button
        type="button"
        className={`attendance-check ${item.attended ? 'checked' : ''}`}
        aria-label={`${item.eventName} on ${item.date} attendance`}
      />
      <p className="attendance-date">{item.date}</p>
      <div className="attendance-details">
        <h3>{item.eventName}</h3>
        <div className="location-row">
          <img src={mapPinAsset} alt="" className="location-icon-image" />
          <span>{item.location}</span>
        </div>
      </div>
    </article>
  );
}

function QrSection({ qrValue, attendanceItems }) {
  return (
    <section className="attendance-panel">
      <p className="qr-heading">QR Code: Show this at each event you attend</p>
      <div className="attendance-content">
        <div className="qr-code-wrapper" role="img" aria-label="Attendee check-in QR code">
          <QRCode value={qrValue} size={220} />
        </div>

        <div className="attendance-list" aria-label="Attendance checklist">
          {attendanceItems.map((item) => (
            <AttendanceItem key={item.id} item={item} />
          ))}
        </div>
      </div>
    </section>
  );
}

export default function ProfilePage() {
  return (
    <section className="profile-panel">
      <ProfileHeader name={attendeeProfile.name} status={attendeeProfile.status} />
      <ProfileBanner />
      <QrSection qrValue={attendeeProfile.qrValue} attendanceItems={attendanceData} />
    </section>
  );
}

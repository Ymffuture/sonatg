import React from 'react';

const PrivacyPage: React.FC = () => {
  const effectiveDate = new Date().toISOString().slice(0, 10);

  return (
    <div style={{ maxWidth: 900, margin: '40px auto', padding: '0 20px', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 32, marginBottom: 8 }}>Privacy Policy</h1>
      <p style={{ color: '#555', marginTop: 0 }}>Effective date: {effectiveDate}</p>

      <p>
        This Privacy Policy explains how we collect, use, and share information when you use our chat application.
      </p>

      <h2 style={{ marginTop: 28 }}>1. Information we collect</h2>
      <p>
        We may collect information you provide directly (e.g., account details, messages) and information
        automatically (e.g., device and usage data, logs). We do not sell personal information.
      </p>

      <h2 style={{ marginTop: 20 }}>2. How we use information</h2>
      <p>
        We use collected information to provide, maintain, and improve the service, to communicate with you, and
        to detect and prevent abuse.
      </p>

      <h2 style={{ marginTop: 20 }}>3. Sharing and disclosure</h2>
      <p>
        We may share information with service providers who perform functions on our behalf, when required by law,
        or to protect rights and safety. We require vendors to maintain appropriate safeguards for personal data.
      </p>

      <h2 style={{ marginTop: 20 }}>4. Security</h2>
      <p>
        We implement reasonable administrative and technical safeguards designed to protect information, but no
        system is completely secure.
      </p>

      <h2 style={{ marginTop: 20 }}>5. Your choices</h2>
      <p>
        You can access, update, or delete your account information in account settings. You may opt out of
        promotional communications by following the instructions in those messages.
      </p>

      <h2 style={{ marginTop: 20 }}>6. Children</h2>
      <p>
        Our service is not intended for children under 13. We do not knowingly collect personal information from
        children under 13.
      </p>

      <h2 style={{ marginTop: 20 }}>7. Changes to this Policy</h2>
      <p>
        We may update this Privacy Policy. When we do, we'll update the effective date above and notify users if
        required by law.
      </p>

      <h2 style={{ marginTop: 20 }}>8. Contact</h2>
      <p>
        If you have questions about this policy, contact us at <a href="mailto:support.sonatg@gmail.com">support.sonatg@gmail.com</a>.
      </p>

      <p style={{ marginTop: 28, color: '#666', fontSize: 13 }}>
        Note: this is a template and not legal advice. Consider consulting legal counsel before publishing.
      </p>
    </div>
  );
};

export default PrivacyPage;

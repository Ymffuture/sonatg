import React from 'react';
import Accordion from '../components/Accordion';

const PrivacyRouterPage: React.FC = () => {
  const effectiveDate = new Date().toISOString().slice(0, 10);

  const items = [
    {
      title: '1. Information we collect',
      content: (
        <p>
          We may collect information you provide directly (e.g., account details, messages) and information
          automatically (e.g., device and usage data, logs). We do not sell personal information.
        </p>
      ),
    },
    {
      title: '2. How we use information',
      content: (
        <p>
          We use collected information to provide, maintain, and improve the service, to communicate with you, and
          to detect and prevent abuse.
        </p>
      ),
    },
    {
      title: '3. Sharing and disclosure',
      content: (
        <p>
          We may share information with service providers who perform functions on our behalf, when required by law,
          or to protect rights and safety. We require vendors to maintain appropriate safeguards for personal data.
        </p>
      ),
    },
    {
      title: '4. Security',
      content: (
        <p>
          We implement reasonable administrative and technical safeguards designed to protect information, but no
          system is completely secure.
        </p>
      ),
    },
    {
      title: '5. Your choices',
      content: (
        <p>
          You can access, update, or delete your account information in account settings. You may opt out of
          promotional communications by following the instructions in those messages.
        </p>
      ),
    },
    {
      title: '6. Children',
      content: (
        <p>
          Our service is not intended for children under 13. We do not knowingly collect personal information from
          children under 13.
        </p>
      ),
    },
    {
      title: '7. Contact',
      content: (
        <p>
          If you have questions about this policy, contact us at <a href="mailto:support.sonatg@gmail.com">support.sonatg@gmail.com</a>.
        </p>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 900, margin: '40px auto', padding: '0 20px', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 32, marginBottom: 8 }}>Privacy Policy</h1>
      <p style={{ color: '#555', marginTop: 0 }}>Effective date: {effectiveDate}</p>

      <Accordion items={items} defaultOpenIndex={-1} />

      <p style={{ marginTop: 28, color: '#666', fontSize: 13 }}>
        Note: this is a template and not legal advice. Consider consulting legal counsel before publishing.
      </p>
    </div>
  );
};

export default PrivacyRouterPage;

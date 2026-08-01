import React from 'react';

const TermsPage: React.FC = () => {
  const effectiveDate = new Date().toISOString().slice(0, 10);

  return (
    <div style={{ maxWidth: 900, margin: '40px auto', padding: '0 20px', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 32, marginBottom: 8 }}>Terms of Service</h1>
      <p style={{ color: '#555', marginTop: 0 }}>Effective date: {effectiveDate}</p>

      <p>
        Welcome to our chat application. These Terms of Service ("Terms") govern your access to and use of the
        services, features and content provided through the app. By using the service you agree to these Terms.
      </p>

      <h2 style={{ marginTop: 28 }}>1. Using the service</h2>
      <p>
        You must follow our policies and applicable laws while using the service. You are responsible for the
        activity that happens on your account and for keeping your account secure.
      </p>

      <h2 style={{ marginTop: 20 }}>2. User content</h2>
      <p>
        You retain ownership of the content you submit. By posting content, you grant the app a license to host,
        use, copy, and display that content to provide the service.
      </p>

      <h2 style={{ marginTop: 20 }}>3. Prohibited conduct</h2>
      <p>
        You may not use the service for illegal activities or to transmit harmful, infringing, or abusive content.
        We may suspend or terminate accounts that violate these terms.
      </p>

      <h2 style={{ marginTop: 20 }}>4. Disclaimers</h2>
      <p>
        The service is provided "as is" and we disclaim warranties to the maximum extent permitted by law.
      </p>

      <h2 style={{ marginTop: 20 }}>5. Limitation of liability</h2>
      <p>
        To the extent permitted by law, we are not liable for indirect, incidental, special, or consequential
        damages arising out of your use of the service.
      </p>

      <h2 style={{ marginTop: 20 }}>6. Changes to these Terms</h2>
      <p>
        We may update these Terms from time to time. When we do, we'll update the "Effective date" above and,
        when required by law, notify you of significant changes.
      </p>

      <h2 style={{ marginTop: 20 }}>7. Contact</h2>
      <p>
        For questions about these Terms, contact us at <a href="mailto:privacy@example.com">privacy@example.com</a>.
      </p>

      <p style={{ marginTop: 28, color: '#666', fontSize: 13 }}>
        Note: this is a template and not legal advice. Consider having these documents reviewed by legal counsel
        before publishing.
      </p>
    </div>
  );
};

export default TermsPage;

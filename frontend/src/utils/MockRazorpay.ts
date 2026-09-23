import logoIconBlue from '../assets/logo-icon-blue.svg';

export class MockRazorpay {
  private options: any;
  private listeners: { [key: string]: Function[] } = {};

  constructor(options: any) {
    this.options = options;
  }

  on(event: string, callback: Function) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  open() {
    // Inject custom animation styles if not already present
    const styleId = 'mock-razorpay-styles';
    if (!document.getElementById(styleId)) {
      const styleEl = document.createElement('style');
      styleEl.id = styleId;
      styleEl.innerHTML = `
        @keyframes mockRzpFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes mockRzpScaleUp {
          from { opacity: 0; transform: scale(0.97) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .mock-rzp-method-card {
          transition: all 0.18s ease;
        }
        .mock-rzp-method-card:hover {
          border-color: #93c5fd !important;
          background-color: #f8fafc !important;
          transform: translateY(-1px);
        }
        .mock-rzp-method-card.selected {
          border-color: #0284c7 !important;
          background-color: #f0f9ff !important;
          box-shadow: 0 1px 3px rgba(2, 132, 199, 0.1);
        }
        .mock-rzp-btn-success {
          transition: all 0.18s ease;
        }
        .mock-rzp-btn-success:hover {
          background-color: #0369a1 !important;
          box-shadow: 0 4px 10px rgba(2, 132, 199, 0.28);
          transform: translateY(-1px);
        }
        .mock-rzp-btn-fail {
          transition: all 0.18s ease;
        }
        .mock-rzp-btn-fail:hover {
          background-color: #fee2e2 !important;
          border-color: #f87171 !important;
        }
        .mock-rzp-close-btn {
          transition: all 0.15s ease;
        }
        .mock-rzp-close-btn:hover {
          background-color: #e2e8f0 !important;
          color: #0f172a !important;
        }
        @media (max-width: 480px) {
          #mock-razorpay-modal {
            max-width: 100% !important;
            margin: 0 !important;
            border-bottom-left-radius: 0 !important;
            border-bottom-right-radius: 0 !important;
            border-top-left-radius: 20px !important;
            border-top-right-radius: 20px !important;
            align-self: flex-end;
          }
          #mock-razorpay-overlay {
            align-items: flex-end !important;
            padding: 0 !important;
          }
        }
      `;
      document.head.appendChild(styleEl);
    }

    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.id = 'mock-razorpay-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.backgroundColor = 'rgba(15, 23, 42, 0.65)';
    overlay.style.backdropFilter = 'blur(6px)';
    (overlay.style as any).webkitBackdropFilter = 'blur(6px)';
    overlay.style.zIndex = '99999';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.padding = '16px';
    overlay.style.animation = 'mockRzpFadeIn 0.2s ease-out';

    // Close function
    const closeModal = () => {
      if (document.body.contains(overlay)) {
        document.body.removeChild(overlay);
      }
      document.removeEventListener('keydown', handleKeyDown);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeModal();
        if (this.options.modal?.ondismiss) {
          this.options.modal.ondismiss();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    overlay.onclick = (e) => {
      if (e.target === overlay) {
        closeModal();
        if (this.options.modal?.ondismiss) {
          this.options.modal.ondismiss();
        }
      }
    };

    // Create modal container
    const modal = document.createElement('div');
    modal.id = 'mock-razorpay-modal';
    modal.style.backgroundColor = '#ffffff';
    modal.style.width = '100%';
    modal.style.maxWidth = '420px';
    modal.style.borderRadius = '20px';
    modal.style.boxShadow = '0 25px 50px -12px rgba(15, 23, 42, 0.25), 0 0 0 1px rgba(226, 232, 240, 0.9)';
    modal.style.display = 'flex';
    modal.style.flexDirection = 'column';
    modal.style.fontFamily = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    modal.style.overflow = 'hidden';
    modal.style.position = 'relative';
    modal.style.animation = 'mockRzpScaleUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)';

    // 1. TOP HEADER & BRANDING
    const header = document.createElement('div');
    header.style.padding = '20px 24px 16px 24px';
    header.style.backgroundColor = '#ffffff';
    header.style.borderBottom = '1px solid #f1f5f9';
    header.style.position = 'relative';

    // Brand and Close Row
    const topRow = document.createElement('div');
    topRow.style.display = 'flex';
    topRow.style.alignItems = 'center';
    topRow.style.justifyContent = 'space-between';
    topRow.style.marginBottom = '14px';

    const brandBadge = document.createElement('div');
    brandBadge.style.display = 'flex';
    brandBadge.style.alignItems = 'center';
    brandBadge.style.gap = '8px';

    const brandIcon = document.createElement('img');
    brandIcon.src = logoIconBlue;
    brandIcon.alt = 'Edrops';
    brandIcon.style.width = '24px';
    brandIcon.style.height = '24px';
    brandIcon.style.objectFit = 'contain';

    const brandText = document.createElement('div');
    brandText.innerHTML = `
      <div style="font-size: 11px; font-weight: 700; color: #0284c7; letter-spacing: 0.05em; text-transform: uppercase;">Edrops Wallet</div>
      <div style="font-size: 13px; font-weight: 600; color: #0f172a;">Add Money</div>
    `;

    brandBadge.appendChild(brandIcon);
    brandBadge.appendChild(brandText);

    // Clean modern close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'mock-rzp-close-btn';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.style.width = '30px';
    closeBtn.style.height = '30px';
    closeBtn.style.borderRadius = '50%';
    closeBtn.style.backgroundColor = '#f1f5f9';
    closeBtn.style.border = 'none';
    closeBtn.style.display = 'flex';
    closeBtn.style.alignItems = 'center';
    closeBtn.style.justifyContent = 'center';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.color = '#64748b';
    closeBtn.innerHTML = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    `;

    closeBtn.onclick = () => {
      closeModal();
      if (this.options.modal?.ondismiss) {
        this.options.modal.ondismiss();
      }
    };

    topRow.appendChild(brandBadge);
    topRow.appendChild(closeBtn);
    header.appendChild(topRow);

    // 2. AMOUNT SECTION
    const amountCard = document.createElement('div');
    amountCard.style.padding = '14px 16px';
    amountCard.style.borderRadius = '14px';
    amountCard.style.backgroundColor = '#f8fafc';
    amountCard.style.border = '1px solid #e2e8f0';

    const rawAmount = typeof this.options.amount === 'number' ? this.options.amount / 100 : 0;
    const formattedAmount = `₹${rawAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const amountLabel = document.createElement('div');
    amountLabel.style.fontSize = '12px';
    amountLabel.style.fontWeight = '500';
    amountLabel.style.color = '#64748b';
    amountLabel.innerText = 'Recharge Amount';

    const amountDisplay = document.createElement('div');
    amountDisplay.style.fontSize = '28px';
    amountDisplay.style.fontWeight = '800';
    amountDisplay.style.color = '#0f172a';
    amountDisplay.style.letterSpacing = '-0.02em';
    amountDisplay.style.margin = '2px 0 6px 0';
    amountDisplay.innerText = formattedAmount;

    const amountNote = document.createElement('div');
    amountNote.style.fontSize = '12px';
    amountNote.style.color = '#64748b';
    amountNote.style.lineHeight = '1.35';
    amountNote.style.display = 'flex';
    amountNote.style.alignItems = 'center';
    amountNote.style.gap = '5px';
    amountNote.innerHTML = `
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0284c7" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="16" x2="12" y2="12"></line>
        <line x1="12" y1="8" x2="12.01" y2="8"></line>
      </svg>
      <span>Wallet balance will be updated after successful payment.</span>
    `;

    amountCard.appendChild(amountLabel);
    amountCard.appendChild(amountDisplay);
    amountCard.appendChild(amountNote);
    header.appendChild(amountCard);

    // Customer contact pill if available
    const contactNumber = this.options.prefill?.contact || '';
    if (contactNumber) {
      const contactPill = document.createElement('div');
      contactPill.style.display = 'flex';
      contactPill.style.alignItems = 'center';
      contactPill.style.gap = '6px';
      contactPill.style.marginTop = '10px';
      contactPill.style.fontSize = '11.5px';
      contactPill.style.color = '#64748b';
      contactPill.innerHTML = `
        <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background-color: #10b981;"></span>
        <span>Paying for <strong>+91 ${contactNumber}</strong></span>
      `;
      header.appendChild(contactPill);
    }

    modal.appendChild(header);

    // 3. PAYMENT METHOD SECTION
    const body = document.createElement('div');
    body.style.padding = '18px 24px 14px 24px';
    body.style.backgroundColor = '#ffffff';

    const methodSectionTitle = document.createElement('div');
    methodSectionTitle.style.fontSize = '12px';
    methodSectionTitle.style.fontWeight = '700';
    methodSectionTitle.style.color = '#475569';
    methodSectionTitle.style.letterSpacing = '0.04em';
    methodSectionTitle.style.textTransform = 'uppercase';
    methodSectionTitle.style.marginBottom = '10px';
    methodSectionTitle.innerText = 'Choose payment method';
    body.appendChild(methodSectionTitle);

    const methodsContainer = document.createElement('div');
    methodsContainer.style.display = 'flex';
    methodsContainer.style.flexDirection = 'column';
    methodsContainer.style.gap = '8px';

    const methodsData = [
      {
        id: 'upi',
        name: 'UPI / QR',
        desc: 'Pay instantly using UPI',
        iconSvg: `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1"></rect>
            <rect x="14" y="3" width="7" height="7" rx="1"></rect>
            <rect x="14" y="14" width="7" height="7" rx="1"></rect>
            <rect x="3" y="14" width="7" height="7" rx="1"></rect>
          </svg>
        `,
      },
      {
        id: 'card',
        name: 'Card',
        desc: 'Credit or debit card',
        iconSvg: `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="5" width="20" height="14" rx="2"></rect>
            <line x1="2" y1="10" x2="22" y2="10"></line>
          </svg>
        `,
      },
      {
        id: 'netbanking',
        name: 'Net Banking',
        desc: 'Pay through your bank',
        iconSvg: `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 21h18M3 10h18M5 10v11M19 10v11M9 10v11M15 10v11M12 2L2 7h20L12 2z"></path>
          </svg>
        `,
      },
      {
        id: 'wallet',
        name: 'Wallet',
        desc: 'Use wallet balance',
        iconSvg: `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"></path>
            <path d="M3 5v14a2 2 0 0 0 2 2h16v-5"></path>
            <path d="M18 12a2 2 0 0 0 0 4h4v-4z"></path>
          </svg>
        `,
      },
    ];

    let selectedMethodId = 'upi';
    const methodElements: { [key: string]: HTMLElement } = {};

    const updateMethodSelection = (newId: string) => {
      selectedMethodId = newId;
      methodsData.forEach((item) => {
        const el = methodElements[item.id];
        if (!el) return;
        const isSelected = item.id === selectedMethodId;
        if (isSelected) {
          el.classList.add('selected');
          const radioDot = el.querySelector('.radio-dot') as HTMLElement;
          if (radioDot) radioDot.style.display = 'block';
          const radioCircle = el.querySelector('.radio-circle') as HTMLElement;
          if (radioCircle) radioCircle.style.borderColor = '#0284c7';
        } else {
          el.classList.remove('selected');
          const radioDot = el.querySelector('.radio-dot') as HTMLElement;
          if (radioDot) radioDot.style.display = 'none';
          const radioCircle = el.querySelector('.radio-circle') as HTMLElement;
          if (radioCircle) radioCircle.style.borderColor = '#cbd5e1';
        }
      });
    };

    methodsData.forEach((item) => {
      const card = document.createElement('div');
      card.className = `mock-rzp-method-card ${item.id === selectedMethodId ? 'selected' : ''}`;
      card.style.backgroundColor = '#ffffff';
      card.style.padding = '10px 14px';
      card.style.borderRadius = '12px';
      card.style.border = '1.5px solid #e2e8f0';
      card.style.display = 'flex';
      card.style.alignItems = 'center';
      card.style.justifyContent = 'space-between';
      card.style.cursor = 'pointer';

      // Left: Icon + Text
      const leftGroup = document.createElement('div');
      leftGroup.style.display = 'flex';
      leftGroup.style.alignItems = 'center';
      leftGroup.style.gap = '12px';

      const iconBox = document.createElement('div');
      iconBox.style.width = '36px';
      iconBox.style.height = '36px';
      iconBox.style.borderRadius = '10px';
      iconBox.style.backgroundColor = '#f1f5f9';
      iconBox.style.color = '#0284c7';
      iconBox.style.display = 'flex';
      iconBox.style.alignItems = 'center';
      iconBox.style.justifyContent = 'center';
      iconBox.innerHTML = item.iconSvg;

      const textGroup = document.createElement('div');
      const nameEl = document.createElement('div');
      nameEl.style.fontSize = '13.5px';
      nameEl.style.fontWeight = '600';
      nameEl.style.color = '#0f172a';
      nameEl.innerText = item.name;

      const descEl = document.createElement('div');
      descEl.style.fontSize = '11.5px';
      descEl.style.color = '#64748b';
      descEl.innerText = item.desc;

      textGroup.appendChild(nameEl);
      textGroup.appendChild(descEl);
      leftGroup.appendChild(iconBox);
      leftGroup.appendChild(textGroup);

      // Right: Custom radio indicator
      const radioCircle = document.createElement('div');
      radioCircle.className = 'radio-circle';
      radioCircle.style.width = '18px';
      radioCircle.style.height = '18px';
      radioCircle.style.borderRadius = '50%';
      radioCircle.style.border = item.id === selectedMethodId ? '2px solid #0284c7' : '2px solid #cbd5e1';
      radioCircle.style.backgroundColor = '#ffffff';
      radioCircle.style.display = 'flex';
      radioCircle.style.alignItems = 'center';
      radioCircle.style.justifyContent = 'center';
      radioCircle.style.transition = 'border-color 0.15s ease';

      const radioDot = document.createElement('div');
      radioDot.className = 'radio-dot';
      radioDot.style.width = '8px';
      radioDot.style.height = '8px';
      radioDot.style.borderRadius = '50%';
      radioDot.style.backgroundColor = '#0284c7';
      radioDot.style.display = item.id === selectedMethodId ? 'block' : 'none';
      radioCircle.appendChild(radioDot);

      card.appendChild(leftGroup);
      card.appendChild(radioCircle);

      card.onclick = () => {
        updateMethodSelection(item.id);
      };

      methodElements[item.id] = card;
      methodsContainer.appendChild(card);
    });

    body.appendChild(methodsContainer);
    modal.appendChild(body);

    // 4. DEVELOPMENT / TEST CONTROLS SECTION
    const footer = document.createElement('div');
    footer.style.backgroundColor = '#f8fafc';
    footer.style.borderTop = '1px solid #e2e8f0';
    footer.style.padding = '16px 24px 20px 24px';
    footer.style.display = 'flex';
    footer.style.flexDirection = 'column';
    footer.style.gap = '10px';

    const testHeader = document.createElement('div');
    testHeader.style.display = 'flex';
    testHeader.style.alignItems = 'center';
    testHeader.style.justifyContent = 'space-between';
    testHeader.style.marginBottom = '2px';

    const testTitle = document.createElement('div');
    testTitle.style.fontSize = '11px';
    testTitle.style.fontWeight = '700';
    testTitle.style.color = '#64748b';
    testTitle.style.letterSpacing = '0.04em';
    testTitle.style.textTransform = 'uppercase';
    testTitle.style.display = 'flex';
    testTitle.style.alignItems = 'center';
    testTitle.style.gap = '5px';
    testTitle.innerHTML = `
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
      </svg>
      <span>Development / Test Controls</span>
    `;

    const sandboxBadge = document.createElement('span');
    sandboxBadge.style.fontSize = '10px';
    sandboxBadge.style.fontWeight = '700';
    sandboxBadge.style.color = '#92400e';
    sandboxBadge.style.backgroundColor = '#fef3c7';
    sandboxBadge.style.border = '1px solid #fde68a';
    sandboxBadge.style.padding = '1px 6px';
    sandboxBadge.style.borderRadius = '4px';
    sandboxBadge.innerText = 'SANDBOX';

    testHeader.appendChild(testTitle);
    testHeader.appendChild(sandboxBadge);
    footer.appendChild(testHeader);

    // Button Row
    const buttonRow = document.createElement('div');
    buttonRow.style.display = 'grid';
    buttonRow.style.gridTemplateColumns = '1fr 1fr';
    buttonRow.style.gap = '10px';

    // Success Button
    const successBtn = document.createElement('button');
    successBtn.className = 'mock-rzp-btn-success';
    successBtn.style.padding = '11px 14px';
    successBtn.style.backgroundColor = '#0284c7';
    successBtn.style.color = '#ffffff';
    successBtn.style.border = 'none';
    successBtn.style.borderRadius = '10px';
    successBtn.style.fontSize = '13px';
    successBtn.style.fontWeight = '600';
    successBtn.style.cursor = 'pointer';
    successBtn.style.display = 'flex';
    successBtn.style.alignItems = 'center';
    successBtn.style.justifyContent = 'center';
    successBtn.style.gap = '6px';
    successBtn.innerHTML = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
      <span>Pay Success (Test)</span>
    `;

    successBtn.onclick = () => {
      closeModal();
      if (this.options.handler) {
        this.options.handler({
          razorpay_payment_id: `pay_mock_${Math.random().toString(36).substring(7)}`,
          razorpay_order_id: this.options.order_id,
          razorpay_signature: 'mock_signature_valid',
        });
      }
    };

    // Failure Button
    const failBtn = document.createElement('button');
    failBtn.className = 'mock-rzp-btn-fail';
    failBtn.style.padding = '11px 14px';
    failBtn.style.backgroundColor = '#ffffff';
    failBtn.style.color = '#dc2626';
    failBtn.style.border = '1px solid #fecaca';
    failBtn.style.borderRadius = '10px';
    failBtn.style.fontSize = '13px';
    failBtn.style.fontWeight = '600';
    failBtn.style.cursor = 'pointer';
    failBtn.style.display = 'flex';
    failBtn.style.alignItems = 'center';
    failBtn.style.justifyContent = 'center';
    failBtn.style.gap = '6px';
    failBtn.innerHTML = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="15" y1="9" x2="9" y2="15"></line>
        <line x1="9" y1="9" x2="15" y2="15"></line>
      </svg>
      <span>Fail Payment (Test)</span>
    `;

    failBtn.onclick = () => {
      closeModal();
      const errObj = {
        error: {
          code: 'BAD_REQUEST_ERROR',
          description: 'Payment failed by user simulation',
          source: 'customer',
          step: 'payment_authentication',
          reason: 'payment_failed',
          metadata: {
            order_id: this.options.order_id,
            payment_id: `pay_mock_${Math.random().toString(36).substring(7)}`,
          },
        },
      };

      // Trigger specific listeners if they exist
      if (this.listeners['payment.failed']) {
        this.listeners['payment.failed'].forEach((cb) => cb(errObj));
      }

      const event = new CustomEvent('razorpay.payment.failed', { detail: errObj });
      window.dispatchEvent(event);

      if (this.options.modal?.ondismiss) {
        this.options.modal.ondismiss();
      }
    };

    buttonRow.appendChild(successBtn);
    buttonRow.appendChild(failBtn);
    footer.appendChild(buttonRow);

    // Subtle Trust / Security Note
    const securityNote = document.createElement('div');
    securityNote.style.textAlign = 'center';
    securityNote.style.fontSize = '11px';
    securityNote.style.color = '#94a3b8';
    securityNote.style.display = 'flex';
    securityNote.style.alignItems = 'center';
    securityNote.style.justifyContent = 'center';
    securityNote.style.gap = '5px';
    securityNote.style.marginTop = '4px';
    securityNote.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
      </svg>
      <span>Secured by Edrops Pay • Sandbox Simulator</span>
    `;
    footer.appendChild(securityNote);

    modal.appendChild(footer);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  }
}

export const injectMockRazorpay = () => {
  const keyId = import.meta.env.VITE_RAZORPAY_KEY_ID || 'mock';
  if (keyId.startsWith('rzp_test_mock') || keyId === 'mock') {
    (window as any).Razorpay = MockRazorpay;
    return true; // indicates it was injected
  }
  return false;
};

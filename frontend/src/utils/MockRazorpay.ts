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
    // Create a modal overlay
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
    overlay.style.zIndex = '99999';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.id = 'mock-razorpay-overlay';

    // Create modal container
    const modal = document.createElement('div');
    modal.style.backgroundColor = '#ffffff';
    modal.style.width = '100%';
    modal.style.maxWidth = '380px';
    modal.style.height = '580px';
    modal.style.borderRadius = '4px';
    modal.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    modal.style.display = 'flex';
    modal.style.flexDirection = 'column';
    modal.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
    modal.style.overflow = 'hidden';
    modal.style.position = 'relative';

    // Header (Razorpay blue)
    const headerColor = this.options.theme?.color || '#3399cc';
    const header = document.createElement('div');
    header.style.backgroundColor = headerColor;
    header.style.color = '#ffffff';
    header.style.padding = '20px 24px';
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'flex-start';

    const headerLeft = document.createElement('div');
    const title = document.createElement('div');
    title.innerText = this.options.name || 'Test Merchant';
    title.style.fontSize = '18px';
    title.style.fontWeight = '500';
    title.style.marginBottom = '4px';

    const desc = document.createElement('div');
    desc.innerText = this.options.description || '';
    desc.style.fontSize = '12px';
    desc.style.opacity = '0.9';

    headerLeft.appendChild(title);
    headerLeft.appendChild(desc);

    const amountDiv = document.createElement('div');
    amountDiv.innerText = `₹${(this.options.amount / 100).toFixed(2)}`;
    amountDiv.style.fontSize = '22px';
    amountDiv.style.fontWeight = '500';

    header.appendChild(headerLeft);
    header.appendChild(amountDiv);

    // Body (Cards/UPI/Netbanking list)
    const body = document.createElement('div');
    body.style.flex = '1';
    body.style.backgroundColor = '#f4f5f8';
    body.style.display = 'flex';
    body.style.flexDirection = 'column';

    const contactBar = document.createElement('div');
    contactBar.style.backgroundColor = '#ffffff';
    contactBar.style.padding = '12px 24px';
    contactBar.style.fontSize = '13px';
    contactBar.style.color = '#515978';
    contactBar.style.borderBottom = '1px solid #e2e4ed';
    contactBar.innerHTML = `<div><span style="font-weight: 500;">English</span> | +91 ${this.options.prefill?.contact || '9876543210'}</div>`;

    body.appendChild(contactBar);

    const methodsContainer = document.createElement('div');
    methodsContainer.style.padding = '16px';
    methodsContainer.style.display = 'flex';
    methodsContainer.style.flexDirection = 'column';
    methodsContainer.style.gap = '8px';

    const createMethod = (name: string, icon: string) => {
      const method = document.createElement('div');
      method.style.backgroundColor = '#ffffff';
      method.style.padding = '14px 16px';
      method.style.borderRadius = '4px';
      method.style.border = '1px solid #e2e4ed';
      method.style.display = 'flex';
      method.style.alignItems = 'center';
      method.style.gap = '12px';
      method.style.cursor = 'pointer';
      method.style.fontSize = '14px';
      method.style.color = '#0d2366';
      method.style.fontWeight = '500';
      method.innerHTML = `<span style="font-size: 20px;">${icon}</span> <span>${name}</span>`;
      return method;
    };

    const upi = createMethod('UPI / QR', '📱');
    const cards = createMethod('Card', '💳');
    const netbanking = createMethod('Netbanking', '🏦');
    const wallet = createMethod('Wallet', '👛');

    methodsContainer.appendChild(upi);
    methodsContainer.appendChild(cards);
    methodsContainer.appendChild(netbanking);
    methodsContainer.appendChild(wallet);

    body.appendChild(methodsContainer);

    // Footer buttons (Simulate success/failure)
    const footer = document.createElement('div');
    footer.style.backgroundColor = '#ffffff';
    footer.style.padding = '16px 24px';
    footer.style.borderTop = '1px solid #e2e4ed';
    footer.style.display = 'flex';
    footer.style.flexDirection = 'column';
    footer.style.gap = '8px';

    const successBtn = document.createElement('button');
    successBtn.innerText = 'Pay Success (Test)';
    successBtn.style.padding = '12px';
    successBtn.style.backgroundColor = headerColor;
    successBtn.style.color = 'white';
    successBtn.style.border = 'none';
    successBtn.style.borderRadius = '4px';
    successBtn.style.fontSize = '14px';
    successBtn.style.fontWeight = '600';
    successBtn.style.cursor = 'pointer';

    successBtn.onclick = () => {
      document.body.removeChild(overlay);
      if (this.options.handler) {
        this.options.handler({
          razorpay_payment_id: `pay_mock_${Math.random().toString(36).substring(7)}`,
          razorpay_order_id: this.options.order_id,
          razorpay_signature: 'mock_signature_valid'
        });
      }
    };

    const failBtn = document.createElement('button');
    failBtn.innerText = 'Fail Payment (Test)';
    failBtn.style.padding = '12px';
    failBtn.style.backgroundColor = '#fdf2f2';
    failBtn.style.color = '#e11d48';
    failBtn.style.border = '1px solid #fecdd3';
    failBtn.style.borderRadius = '4px';
    failBtn.style.fontSize = '14px';
    failBtn.style.fontWeight = '600';
    failBtn.style.cursor = 'pointer';

    failBtn.onclick = () => {
      document.body.removeChild(overlay);
      const errObj = {
        error: {
          code: "BAD_REQUEST_ERROR",
          description: "Payment failed by user simulation",
          source: "customer",
          step: "payment_authentication",
          reason: "payment_failed",
          metadata: {
            order_id: this.options.order_id,
            payment_id: `pay_mock_${Math.random().toString(36).substring(7)}`
          }
        }
      };
      
      // Trigger specific listeners if they exist
      if (this.listeners['payment.failed']) {
        this.listeners['payment.failed'].forEach(cb => cb(errObj));
      }

      const event = new CustomEvent('razorpay.payment.failed', { detail: errObj });
      window.dispatchEvent(event);
      
      if (this.options.modal?.ondismiss) {
        this.options.modal.ondismiss();
      }
    };

    const closeBtn = document.createElement('button');
    closeBtn.innerText = '✕';
    closeBtn.style.position = 'absolute';
    closeBtn.style.top = '16px';
    closeBtn.style.right = '16px';
    closeBtn.style.background = 'transparent';
    closeBtn.style.border = 'none';
    closeBtn.style.color = 'white';
    closeBtn.style.fontSize = '18px';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.opacity = '0.8';
    
    closeBtn.onclick = () => {
      document.body.removeChild(overlay);
      if (this.options.modal?.ondismiss) {
        this.options.modal.ondismiss();
      }
    };

    header.appendChild(closeBtn);
    footer.appendChild(successBtn);
    footer.appendChild(failBtn);

    // Razorpay footer branding
    const branding = document.createElement('div');
    branding.style.textAlign = 'center';
    branding.style.padding = '12px';
    branding.style.fontSize = '11px';
    branding.style.color = '#8a92a6';
    branding.style.backgroundColor = '#f4f5f8';
    branding.innerHTML = 'Secured by <strong>Razorpay</strong> (Test Mode)';

    modal.appendChild(header);
    modal.appendChild(body);
    modal.appendChild(footer);
    modal.appendChild(branding);
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

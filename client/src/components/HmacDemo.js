import React, { useState } from 'react';
import { signHMAC, verifyHMAC } from '../helpers/crypto';
import { IoClose } from 'react-icons/io5';

const HmacDemo = ({ onClose }) => {
  const [message, setMessage] = useState('');
  const [hmac, setHmac] = useState('');
  const [tamperedMessage, setTamperedMessage] = useState('');
  const [tamperedHmac, setTamperedHmac] = useState('');
  const [verifyResult, setVerifyResult] = useState(null);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    const hmacValue = await signHMAC(message);
    setHmac(hmacValue);
    setTamperedMessage(message);
    setTamperedHmac(hmacValue);
    setStep(2);
    setVerifyResult(null);
    setLoading(false);
  };

  const handleVerify = async () => {
    setLoading(true);
    const valid = await verifyHMAC(tamperedMessage, tamperedHmac);
    setVerifyResult(valid);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-lg relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 focus:outline-none"
        >
          <IoClose size={24} />
        </button>
        <h2 className="text-xl font-semibold text-center mb-6 text-blue-700">HMAC Authenticity & Integrity Demo</h2>
        {step === 1 && (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Message</label>
              <input
                type="text"
                value={message}
                onChange={e => setMessage(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                placeholder="Type your message here..."
              />
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleGenerate}
                disabled={loading || !message.trim()}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Generating...' : 'Generate HMAC'}
              </button>
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Message (edit to tamper)</label>
              <input
                type="text"
                value={tamperedMessage}
                onChange={e => setTamperedMessage(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded font-mono text-xs"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">HMAC (edit to tamper)</label>
              <input
                type="text"
                value={tamperedHmac}
                onChange={e => setTamperedHmac(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded font-mono text-xs"
              />
            </div>
            <div className="flex items-center gap-4 mb-4">
              <button
                type="button"
                onClick={handleVerify}
                disabled={loading}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
              >
                {loading ? 'Verifying...' : 'Verify HMAC'}
              </button>
              {verifyResult !== null && (
                <span className={`font-semibold ${verifyResult ? 'text-green-600' : 'text-red-600'}`}>
                  {verifyResult ? '✅ HMAC Valid (Not Tampered)' : '❌ HMAC Invalid (Tampered)'}
                </span>
              )}
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
              >
                Start Over
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default HmacDemo; 
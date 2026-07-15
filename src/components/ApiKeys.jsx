// admin-panel/src/components/ApiKeys.jsx
import React, { useEffect, useState } from "react";
import { apiKeysAPI } from "../services/api"; // your existing API wrapper
import toast from "react-hot-toast";

function maskKey(k) {
  if (!k) return "";
  return k.length > 8 ? `${k.slice(0,4)}••••${k.slice(-4)}` : "••••••••";
}

export default function ApiKeys() {
  const [keys, setKeys] = useState([]);          // list metadata from GET /apikeys
  const [loading, setLoading] = useState(false);
  const [showNewKey, setShowNewKey] = useState(null); // plaintext of newly created/rotated key
  const [revealing, setRevealing] = useState({}); // id -> bool

  useEffect(() => {
    fetchKeys();
  }, []);

  async function fetchKeys() {
    setLoading(true);
    try {
     const res = await apiKeysAPI.list();
    setKeys(res.data);
    } catch (err) {
      console.error("Failed to load keys", err);
      toast.error("Failed to load API keys");
    } finally {
      setLoading(false);
    }
  }

  // Copy helper
  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("API key copied to clipboard");
    } catch (err) {
      console.error("Clipboard error", err);
      toast.error("Failed to copy (permission?)");
    }
  }

  // Called when user clicks Copy for an existing key object.
  // If the listing already contains plaintext (rare) use it; otherwise call reveal endpoint.
  async function revealAndCopy(keyObj) {
    if (!keyObj) return;
    // If key property is present and looks long, copy it directly
    if (keyObj.key && keyObj.key.length > 10) {
      await copyToClipboard(keyObj.key);
      return;
    }

    // Otherwise call server to reveal (apiKeysAPI.reveal)
    try {
      setRevealing(prev => ({...prev, [keyObj.id]: true}));
      const res = await apiKeysAPI.reveal(keyObj.id);
      const plain = res.data && res.data.key;
      if (plain) {
        await copyToClipboard(plain);
        toast.success("Key revealed and copied");
      } else {
        toast.error("Server did not return key");
      }
    } catch (err) {
      console.error("Reveal failed", err);
      toast.error("Cannot reveal key (permission or server error)");
    } finally {
      setRevealing(prev => ({...prev, [keyObj.id]: false}));
    }
  }

  // Create a new key and display the plaintext (server should return it)
  async function createKey() {
    try {
      const label = "web-ui"; // adjust if you collect a label
      const res = await apiKeysAPI.create(label);
      const created = res.data;
      if (created && created.key) {
        // show plaintext for copy
        setShowNewKey(created.key);
        toast.success("API key created (copy it now)");
      } else {
        toast.success("API key created");
      }
      await fetchKeys();
    } catch (err) {
      console.error("Create key failed", err);
      toast.error("Failed to create API key");
    }
  }

  async function rotateKey(id) {
    try {
      const res = await apiKeysAPI.rotate(id);
      // rotate should return the new plaintext key in res.data.key
      if (res.data && res.data.key) {
        setShowNewKey(res.data.key);
        toast.success("Key rotated — copy new key now");
      } else {
        toast.success("Key rotated");
      }
      await fetchKeys();
    } catch (err) {
      console.error("Rotate failed", err);
      toast.error("Failed to rotate key");
    }
  }

  async function revokeKey(id) {
    try {
      await apiKeysAPI.revoke(id);
      toast.success("Key revoked");
      await fetchKeys();
    } catch (err) {
      console.error("Revoke failed", err);
      toast.error("Failed to revoke key");
    }
  }

  // Top card: prefer showing the most-recent active key (not revoked)
  const activeKey = keys.find(k => !k.revoked_at) || null;

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">API Key</h2>

      <div className="p-4 bg-white rounded shadow-sm mb-6">
        <div style={{display: "flex", alignItems: "center", gap: 12}}>
          <div style={{flex:1}}>
            <div className="text-sm text-gray-600">Your API key</div>
            <div className="mt-2">
              <input
                readOnly
                value={ showNewKey ? showNewKey : (activeKey ? (activeKey.key && activeKey.key.length>0 ? activeKey.key : maskKey(activeKey.masked || "")) : "") }
                type={ showNewKey || (activeKey && activeKey.key && activeKey.key.length>0) ? "text" : "password" }
                className="w-full p-2 border rounded"
                placeholder={activeKey ? "API key hidden" : "No API key yet"}
              />
            </div>
          </div>

          <div style={{display: "flex", flexDirection: "column", gap:8}}>
            <button
              onClick={ async () => {
                if (showNewKey) return copyToClipboard(showNewKey);
                if (activeKey) return revealAndCopy(activeKey);
                toast("No key to copy — create one");
              }}
              className="px-3 py-2 border rounded"
            >
              📋 Copy
            </button>

            <button onClick={createKey} className="px-3 py-2 border rounded">
              ➕ Create Key
            </button>
          </div>
        </div>

        <div className="text-xs text-gray-500 mt-3">
          Your application must set this API key in <code>AppConfig.API_KEY</code> in the Android source.
        </div>
      </div>

      {/* Newly created key shown as a temporary reveal block */}
      { showNewKey && (
        <div className="p-4 bg-yellow-50 rounded mb-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">New API Key</div>
              <div className="text-xs text-gray-600">This key will only be shown now — copy it and store it safely.</div>
            </div>

            <div style={{display:"flex", gap:8}}>
              <button onClick={() => copyToClipboard(showNewKey)} className="px-3 py-2 border rounded">Copy</button>
              <button onClick={() => setShowNewKey(null)} className="px-3 py-2 border rounded">Dismiss</button>
            </div>
          </div>
        </div>
      )}

      {/* List of existing keys */}
      <div className="mt-2">
        <h3 className="text-md font-medium mb-2">Your Keys</h3>

        { loading ? <div>Loading…</div> : (
          <table className="w-full bg-white rounded shadow-sm">
            <thead>
              <tr>
                <th className="p-2 text-left">Label</th>
                <th className="p-2 text-left">Created</th>
                <th className="p-2 text-left">Status</th>
                <th className="p-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              { keys.length === 0 && (
                <tr><td colSpan={4} className="p-4 text-center text-gray-500">No keys created yet</td></tr>
              )}

              { keys.map(k => (
                <tr key={k.id} className="border-t">
                  <td className="p-2">{k.label || "key-"+k.id}</td>
                  <td className="p-2">{ new Date(k.created_at).toLocaleString()}</td>
                  <td className="p-2">{ k.revoked_at ? "revoked" : "active" }</td>
                  <td className="p-2 text-right">
                    { !k.revoked_at && (
                      <>
                        <button
                          onClick={() => revealAndCopy(k)}
                          disabled={revealing[k.id]}
                          className="px-2 py-1 mr-2 border rounded"
                        >
                          {revealing[k.id] ? "…" : "Copy"}
                        </button>

                        <button onClick={() => rotateKey(k.id)} className="px-2 py-1 mr-2 border rounded">Rotate</button>
                        <button onClick={() => revokeKey(k.id)} className="px-2 py-1 border rounded">Revoke</button>
                      </>
                    )}
                    { k.revoked_at && <span className="text-xs text-gray-500">No actions</span> }
                  </td>
                </tr>
              )) }
            </tbody>
          </table>
        ) }
      </div>

    </div>
  );
}

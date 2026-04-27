"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import { User, Edit, Save, FileText, CreditCard, Crown, Calendar, DollarSign, Download, ExternalLink, LogOut, Menu, X } from 'lucide-react';

export default function Profile() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('profile');
  const [isEditing, setIsEditing] = useState(false);
  const [profileData, setProfileData] = useState({
    name: 'John Doe', email: 'john.doe@example.com', phone: '+1 (555) 123-4567',
    youtubeLink: 'https://youtube.com/@johndoe', instagramLink: 'https://instagram.com/johndoe',
    facebookLink: 'https://facebook.com/johndoe', twitterLink: 'https://twitter.com/johndoe',
    billingAddress: '123 Main St, New York, NY 10001'
  });
  const [editData, setEditData] = useState(profileData);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  const handleSave = () => { setProfileData(editData); setIsEditing(false); };
  const handleCancel = () => { setEditData(profileData); setIsEditing(false); };
  const handleLogout = () => { localStorage.removeItem('sb-xncfghdikiqknuruurfh-auth-token'); router.push('/auth'); };

  const downloadInvoice = (invoiceId: string) => {
    const content = `Invoice #${invoiceId}\nDate: ${new Date().toLocaleDateString()}\nAmount: $29.99\nPlan: Pro Monthly`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `invoice-${invoiceId}.txt`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const myScripts = [
    { id: 1, title: "The Hidden Impact of Climate Change on Global Economy", createdAt: "2024-01-15", words: 1247, status: "Published" },
    { id: 2, title: "Future of Artificial Intelligence in Healthcare", createdAt: "2024-01-10", words: 1456, status: "Draft" },
    { id: 3, title: "Sustainable Energy Solutions for Modern Cities", createdAt: "2024-01-08", words: 1123, status: "Published" },
  ];

  const subscriptionData = { plan: "Pro", status: "Active", nextBilling: "2024-02-15", scriptsGenerated: 15, scriptsLimit: 50 };

  const billingHistory = [
    { id: "INV-001", date: "2024-01-15", amount: "$29.99", plan: "Pro Monthly", status: "Paid" },
    { id: "INV-002", date: "2023-12-15", amount: "$29.99", plan: "Pro Monthly", status: "Paid" },
    { id: "INV-003", date: "2023-11-15", amount: "$29.99", plan: "Pro Monthly", status: "Paid" },
  ];

  const menuItems = [
    { id: 'profile', label: 'Basic Details', icon: User },
    { id: 'scripts', label: 'My Scripts', icon: FileText },
    { id: 'subscription', label: 'Subscription', icon: Crown },
    { id: 'billing', label: 'Billing', icon: CreditCard },
  ];

  const nav = (
    <div className="space-y-2">
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-2">
        <nav className="space-y-0.5">
          {menuItems.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => { setActiveTab(id); setIsMobileNavOpen(false); }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left text-sm transition-all ${activeTab === id ? 'bg-[#1d1d1f] text-white font-medium' : 'text-[#1d1d1f] hover:bg-[#f5f5f7]'}`}>
              <Icon className="w-4 h-4 flex-shrink-0" />{label}
            </button>
          ))}
        </nav>
      </div>
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-2">
        <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left text-sm text-red-500 hover:bg-red-50 transition-colors">
          <LogOut className="w-4 h-4 flex-shrink-0" />Logout
        </button>
      </div>
    </div>
  );

  const profileFields = [
    { id: 'name', label: 'Full Name', type: 'text', key: 'name' as const },
    { id: 'email', label: 'Email', type: 'email', key: 'email' as const },
    { id: 'phone', label: 'Phone', type: 'text', key: 'phone' as const },
    { id: 'youtube', label: 'YouTube Link', type: 'text', key: 'youtubeLink' as const },
    { id: 'instagram', label: 'Instagram Link', type: 'text', key: 'instagramLink' as const },
    { id: 'facebook', label: 'Facebook Link', type: 'text', key: 'facebookLink' as const },
    { id: 'twitter', label: 'Twitter Link', type: 'text', key: 'twitterLink' as const },
  ];

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      <Header />

      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-10 py-10">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#1d1d1f] mb-1"
            style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif' }}>
            My Profile
          </h1>
          <p className="text-sm text-[#6e6e73] font-light">Manage your account settings and content</p>
        </div>

        {/* Mobile nav toggle */}
        <div className="mb-4 flex lg:hidden">
          <button onClick={() => setIsMobileNavOpen(true)} className="flex items-center gap-2 text-sm font-medium text-[#1d1d1f] bg-white border border-gray-200 px-4 py-2 rounded-xl">
            <Menu className="w-4 h-4" /> Menu
          </button>
        </div>

        {/* Mobile drawer */}
        {isMobileNavOpen && (
          <>
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40" onClick={() => setIsMobileNavOpen(false)} />
            <div className="fixed top-0 left-0 bottom-0 z-50 w-[min(288px,85vw)] bg-[#f5f5f7] shadow-2xl p-4 flex flex-col gap-4 overflow-y-auto">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-[#1d1d1f]">Menu</h2>
                <button onClick={() => setIsMobileNavOpen(false)} className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
                  <X className="w-4 h-4" />
                </button>
              </div>
              {nav}
            </div>
          </>
        )}

        <div className="flex flex-col lg:flex-row gap-5">
          {/* Sidebar */}
          <div className="hidden lg:block w-56 flex-shrink-0">{nav}</div>

          {/* Content */}
          <div className="flex-1 min-w-0">

            {/* Profile */}
            {activeTab === 'profile' && (
              <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-[#1d1d1f]">Profile Information</h2>
                    <p className="text-[11px] text-[#6e6e73] font-light mt-0.5">Update your personal information and social links</p>
                  </div>
                  {!isEditing ? (
                    <button onClick={() => { setIsEditing(true); setEditData(profileData); }}
                      className="flex items-center gap-2 text-xs font-medium text-[#1d1d1f] bg-[#f5f5f7] hover:bg-gray-200 border border-gray-200 px-4 py-2 rounded-xl transition-colors">
                      <Edit className="w-3.5 h-3.5" />Edit
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={handleSave} className="flex items-center gap-1.5 text-xs font-medium text-white bg-[#1d1d1f] hover:bg-black px-4 py-2 rounded-xl transition-colors">
                        <Save className="w-3.5 h-3.5" />Save
                      </button>
                      <button onClick={handleCancel} className="text-xs font-medium text-[#1d1d1f] bg-[#f5f5f7] hover:bg-gray-200 border border-gray-200 px-4 py-2 rounded-xl transition-colors">Cancel</button>
                    </div>
                  )}
                </div>
                <div className="px-6 py-5 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {profileFields.map(f => (
                      <div key={f.id}>
                        <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5">{f.label}</label>
                        <input id={f.id} type={f.type}
                          value={isEditing ? editData[f.key] : profileData[f.key]}
                          onChange={e => setEditData({ ...editData, [f.key]: e.target.value })}
                          disabled={!isEditing}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-[#f5f5f7] text-[#1d1d1f] text-sm placeholder-[#a1a1a6] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/20 focus:border-[#1d1d1f] disabled:text-[#6e6e73] transition-all"
                        />
                      </div>
                    ))}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5">Billing Address</label>
                    <input type="text"
                      value={isEditing ? editData.billingAddress : profileData.billingAddress}
                      onChange={e => setEditData({ ...editData, billingAddress: e.target.value })}
                      disabled={!isEditing}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-[#f5f5f7] text-[#1d1d1f] text-sm placeholder-[#a1a1a6] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/20 focus:border-[#1d1d1f] disabled:text-[#6e6e73] transition-all"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Scripts */}
            {activeTab === 'scripts' && (
              <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-100">
                  <h2 className="text-sm font-semibold text-[#1d1d1f]">My Scripts</h2>
                  <p className="text-[11px] text-[#6e6e73] font-light mt-0.5">View and manage your generated scripts</p>
                </div>
                <div className="px-6 py-4 space-y-3">
                  {myScripts.map(script => (
                    <div key={script.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-[#f5f5f7] rounded-2xl border border-gray-100">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#1d1d1f] truncate">{script.title}</p>
                        <div className="flex flex-wrap items-center gap-3 mt-1">
                          <span className="text-[11px] text-[#6e6e73] font-light">{script.createdAt}</span>
                          <span className="text-[11px] text-[#6e6e73] font-light">{script.words} words</span>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${script.status === 'Published' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                            {script.status}
                          </span>
                        </div>
                      </div>
                      <button onClick={() => router.push('/script')} className="flex items-center gap-1.5 text-xs font-medium text-[#1d1d1f] bg-white hover:bg-gray-100 border border-gray-200 px-4 py-2 rounded-xl transition-colors flex-shrink-0">
                        <ExternalLink className="w-3.5 h-3.5" />View Script
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Subscription */}
            {activeTab === 'subscription' && (
              <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-100">
                  <h2 className="text-sm font-semibold text-[#1d1d1f]">My Subscription</h2>
                  <p className="text-[11px] text-[#6e6e73] font-light mt-0.5">Manage your subscription and usage</p>
                </div>
                <div className="px-6 py-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                    <div className="space-y-4">
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-[#6e6e73] mb-2">Current Plan</p>
                        <div className="flex items-center gap-2">
                          <Crown className="w-5 h-5 text-amber-500" />
                          <span className="text-lg font-semibold text-[#1d1d1f]">{subscriptionData.plan}</span>
                          <span className="text-[10px] font-semibold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{subscriptionData.status}</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-[#6e6e73] mb-1.5">Next Billing Date</p>
                        <div className="flex items-center gap-2 text-sm text-[#1d1d1f]">
                          <Calendar className="w-4 h-4 text-[#6e6e73]" />{subscriptionData.nextBilling}
                        </div>
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-[#6e6e73] mb-2">Scripts Generated</p>
                      <p className="text-3xl font-bold text-[#1d1d1f] mb-2">
                        {subscriptionData.scriptsGenerated} <span className="text-base font-light text-[#6e6e73]">/ {subscriptionData.scriptsLimit}</span>
                      </p>
                      <div className="h-2 rounded-full bg-gray-100">
                        <div className="h-full rounded-full bg-[#1d1d1f]" style={{ width: `${(subscriptionData.scriptsGenerated / subscriptionData.scriptsLimit) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button onClick={() => router.push('/pricing')} className="text-sm font-medium text-white bg-[#1d1d1f] hover:bg-black px-5 py-2.5 rounded-xl transition-colors">Upgrade Plan</button>
                    <button className="text-sm font-medium text-red-500 bg-red-50 hover:bg-red-100 px-5 py-2.5 rounded-xl transition-colors">Cancel Subscription</button>
                  </div>
                </div>
              </div>
            )}

            {/* Billing */}
            {activeTab === 'billing' && (
              <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-100">
                  <h2 className="text-sm font-semibold text-[#1d1d1f]">Billing Details</h2>
                  <p className="text-[11px] text-[#6e6e73] font-light mt-0.5">View your billing history and download invoices</p>
                </div>
                <div className="px-6 py-4 space-y-3">
                  {billingHistory.map(bill => (
                    <div key={bill.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-[#f5f5f7] rounded-2xl border border-gray-100">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center flex-shrink-0">
                          <DollarSign className="w-4 h-4 text-[#1d1d1f]" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-[#1d1d1f]">{bill.plan}</p>
                          <p className="text-[11px] text-[#6e6e73] font-light">{bill.date}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                        <span className="text-sm font-semibold text-[#1d1d1f]">{bill.amount}</span>
                        <span className="text-[10px] font-semibold bg-green-100 text-green-700 px-2.5 py-0.5 rounded-full">{bill.status}</span>
                        <button onClick={() => downloadInvoice(bill.id)} className="flex items-center gap-1.5 text-xs font-medium text-[#1d1d1f] bg-white hover:bg-gray-100 border border-gray-200 px-3 py-2 rounded-lg transition-colors min-h-[36px]">
                          <Download className="w-3.5 h-3.5" />Invoice
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}

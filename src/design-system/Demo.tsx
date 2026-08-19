import React, { useState } from 'react'
import { Bell, Car, Check, Search } from 'lucide-react'
import { Avatar, Badge, Button, Card, IconButton, Input, Select, Sheet, Skeleton, Switch } from './index'

export function Demo() {
  const [rtl, setRtl] = useState(true)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [enabled, setEnabled] = useState(true)
  return (
    <main dir={rtl ? 'rtl' : 'ltr'} className="min-h-screen bg-slate-50 p-6 font-sans text-primary md:p-10">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div><p className="text-xs font-medium uppercase tracking-widest text-accent">ATHAR GPS</p><h1 className="mt-2 text-3xl font-semibold">Design System</h1></div>
          <Button variant="secondary" icon={<Check className="h-4 w-4" />} onClick={() => setRtl(value => !value)}>RTL: {rtl ? 'ON' : 'OFF'}</Button>
        </header>
        <Card><div className="grid gap-6 md:grid-cols-2"><div><h2 className="mb-4 text-base font-semibold">Buttons & status</h2><div className="flex flex-wrap gap-2"><Button icon={<Car className="h-4 w-4" />}>Primary</Button><Button variant="secondary">Secondary</Button><Button variant="ghost">Ghost</Button><Button variant="destructive">Delete</Button><Button loading>Loading</Button></div></div><div className="flex flex-wrap content-start items-center gap-2"><Badge variant="online">متصل</Badge><Badge variant="idle">متوقف</Badge><Badge variant="alert">تنبيه</Badge><Badge variant="danger">خطر</Badge><Badge variant="offline">غير متصل</Badge></div></div></Card>
        <Card><h2 className="mb-4 text-base font-semibold">Form controls</h2><div className="grid gap-4 md:grid-cols-3"><Input label="بحث عن مركبة" placeholder="اكتب اسم المركبة" icon={<Search className="h-4 w-4" />} /><Select label="الحالة" placeholder="اختر الحالة" options={[{ value: 'online', label: 'متصل' }, { value: 'offline', label: 'غير متصل' }]} /><Switch label="التنبيهات الفورية" description="استقبال تحديثات المركبات" checked={enabled} onChange={setEnabled} /></div></Card>
        <Card><h2 className="mb-4 text-base font-semibold">People & loading</h2><div className="flex items-center gap-3"><Avatar name="Athar GPS" status="online" size="lg" /><Avatar name="محمد العلوي" status="idle" /><IconButton label="Notifications" icon={<Bell className="h-5 w-5" />} /><Skeleton variant="text" width="180px" /></div></Card>
        <Button onClick={() => setSheetOpen(true)}>Open bottom sheet</Button>
        <Sheet isOpen={sheetOpen} onClose={() => setSheetOpen(false)} title="معلومات المركبة" stage="peek"><p className="text-sm text-slate-500">هذه معاينة لمكوّن Bottom Sheet بثلاث حالات ارتفاع.</p></Sheet>
      </div>
    </main>
  )
}

export default Demo
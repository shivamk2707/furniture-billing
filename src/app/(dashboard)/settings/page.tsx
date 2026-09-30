import { getCompanySettings } from '@/actions/settings'
import { SettingsForm } from './settings-form'

export default async function SettingsPage() {
  const settings = await getCompanySettings()

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Company Settings</h1>
      <SettingsForm initialValues={settings} />
    </div>
  )
}

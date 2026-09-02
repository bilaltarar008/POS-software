import { supabase } from '@/lib/supabase'

export default async function Home() {
  const { data, error } = await supabase.from('test_items').select('*')

  return (
    <main style={{ padding: '2rem' }}>
      <h1>Supabase Connection Test</h1>
      {error && <p style={{ color: 'red' }}>Error: {error.message}</p>}
      {data && (
        <ul>
          {data.map((item) => (
            <li key={item.id}>{item.name}</li>
          ))}
        </ul>
      )}
    </main>
  )
}
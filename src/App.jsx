import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useParams,
} from 'react-router-dom'
import './App.css'

const SURAH_LIST_API = 'https://api.alquran.cloud/v1/surah'

const revelationStyles = {
  Meccan: 'meccan',
  Medinan: 'medinan',
}

function useSurahDirectory() {
  const [surahs, setSurahs] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()

    async function loadSurahs() {
      try {
        setIsLoading(true)
        setError('')

        const response = await fetch(SURAH_LIST_API, { signal: controller.signal })
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`)
        }

        const payload = await response.json()
        setSurahs(payload.data ?? [])
      } catch (fetchError) {
        if (fetchError.name !== 'AbortError') {
          setError('Unable to load surahs right now. Please try again.')
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    loadSurahs()

    return () => controller.abort()
  }, [])

  return { surahs, isLoading, error }
}

function HomePage() {
  const { surahs, isLoading, error } = useSurahDirectory()
  const [search, setSearch] = useState('')
  const [revelationFilter, setRevelationFilter] = useState('All')
  const deferredSearch = useDeferredValue(search)

  const filteredSurahs = useMemo(() => {
    const normalizedSearch = deferredSearch.trim().toLowerCase()

    return surahs.filter((surah) => {
      const matchesFilter =
        revelationFilter === 'All' || surah.revelationType === revelationFilter

      const matchesSearch =
        normalizedSearch.length === 0 ||
        surah.englishName.toLowerCase().includes(normalizedSearch) ||
        surah.englishNameTranslation.toLowerCase().includes(normalizedSearch) ||
        surah.name.includes(deferredSearch.trim()) ||
        String(surah.number).includes(normalizedSearch)

      return matchesFilter && matchesSearch
    })
  }, [deferredSearch, revelationFilter, surahs])

  const summary = useMemo(() => {
    const totalAyahs = filteredSurahs.reduce(
      (ayahCount, surah) => ayahCount + surah.numberOfAyahs,
      0,
    )

    return {
      surahCount: filteredSurahs.length,
      ayahCount: totalAyahs,
    }
  }, [filteredSurahs])

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <p className="eyebrow">Quran Reader</p>
        <h1>Choose a surah, then read it on its own page.</h1>
        
        <div className="hero-stats" aria-label="Dataset summary">
          <article>
            <span>Surahs shown</span>
            <strong>{summary.surahCount}</strong>
          </article>
          <article>
            <span>Total ayahs</span>
            <strong>{summary.ayahCount}</strong>
          </article>
      
        </div>
      </section>

      <section className="controls-panel" aria-label="Search and filters">
        <label className="search-field">
          <span>Search surahs</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Try Al-Faatiha, The Opening, 1, or Arabic text"
          />
        </label>

        <div className="filter-group" role="group" aria-label="Revelation type">
          {['All', 'Meccan', 'Medinan'].map((option) => (
            <button
              key={option}
              type="button"
              className={option === revelationFilter ? 'active' : ''}
              onClick={() => setRevelationFilter(option)}
            >
              {option}
            </button>
          ))}
        </div>
      </section>

      {isLoading ? (
        <section className="status-panel">Loading surahs from the API...</section>
      ) : null}

      {error ? <section className="status-panel error">{error}</section> : null}

      {!isLoading && !error ? (
        <section className="surah-list home-list" aria-label="Surah list">
          {filteredSurahs.length ? (
            filteredSurahs.map((surah) => (
              <Link
                key={surah.number}
                className="surah-card surah-link"
                to={`/surah/${surah.number}`}
              >
                <span className="surah-number">{surah.number}</span>
                <div className="surah-copy">
                  <strong>{surah.englishName}</strong>
                  <span>{surah.englishNameTranslation}</span>
                </div>
                <span
                  className={`surah-tag ${
                    revelationStyles[surah.revelationType] ?? ''
                  }`}
                >
                  {surah.revelationType}
                </span>
              </Link>
            ))
          ) : (
            <div className="empty-state">
              No surahs match this search. Try a broader name or remove the
              filter.
            </div>
          )}
        </section>
      ) : null}
    </main>
  )
}

function ReaderPage() {
  const { surahNumber } = useParams()
  const navigate = useNavigate()
  const { surahs, isLoading, error } = useSurahDirectory()
  const [selectedSurahAyahs, setSelectedSurahAyahs] = useState([])
  const [isReading, setIsReading] = useState(false)
  const [readerError, setReaderError] = useState('')

  const currentSurahNumber = Number(surahNumber)
  const selectedSurah = surahs.find((surah) => surah.number === currentSurahNumber)
  const currentSurahIndex = surahs.findIndex(
    (surah) => surah.number === currentSurahNumber,
  )

  useEffect(() => {
    if (!selectedSurah) {
      setSelectedSurahAyahs([])
      return
    }

    const controller = new AbortController()

    async function loadReader() {
      try {
        setIsReading(true)
        setReaderError('')

        const response = await fetch(
          `${SURAH_LIST_API}/${selectedSurah.number}/editions/quran-uthmani,en.asad`,
          { signal: controller.signal },
        )

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`)
        }

        const payload = await response.json()
        const [arabicEdition, englishEdition] = payload.data ?? []
        const englishAyahs = englishEdition?.ayahs ?? []

        const combinedAyahs = (arabicEdition?.ayahs ?? []).map((ayah, index) => ({
          numberInSurah: ayah.numberInSurah,
          arabic: ayah.text.replace(/^\uFEFF/, ''),
          english: englishAyahs[index]?.text ?? '',
        }))

        setSelectedSurahAyahs(combinedAyahs)
      } catch (fetchError) {
        if (fetchError.name !== 'AbortError') {
          setReaderError('Unable to load the Arabic and English reader.')
          setSelectedSurahAyahs([])
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsReading(false)
        }
      }
    }

    loadReader()

    return () => controller.abort()
  }, [selectedSurah])

  function goToAdjacentSurah(direction) {
    const nextSurah = surahs[currentSurahIndex + direction]

    if (nextSurah) {
      navigate(`/surah/${nextSurah.number}`)
    }
  }

  if (!isLoading && !error && surahs.length > 0 && !selectedSurah) {
    return <Navigate to="/surah/1" replace />
  }

  return (
    <main className="app-shell reader-shell">
      <section className="detail-panel centered-reader" aria-live="polite">
        <div className="reader-topbar">
          <Link className="back-link" to="/">
            Back to home
          </Link>
        </div>

        {isLoading ? (
          <div className="status-panel">Loading surah directory...</div>
        ) : null}

        {error ? <div className="status-panel error">{error}</div> : null}

        {!isLoading && !error && selectedSurah ? (
          <>
            <div className="reader-nav" aria-label="Surah navigation">
              <button
                type="button"
                onClick={() => goToAdjacentSurah(-1)}
                disabled={currentSurahIndex <= 0}
              >
                Previous Surah
              </button>
              <div className="reader-position">
                {selectedSurah.number} / {surahs.length}
              </div>
              <button
                type="button"
                onClick={() => goToAdjacentSurah(1)}
                disabled={currentSurahIndex >= surahs.length - 1}
              >
                Next Surah
              </button>
            </div>

            <div className="detail-header">
              <p className="detail-label">Now reading</p>
              <h2>{selectedSurah.englishName}</h2>
              <p className="detail-translation">
                {selectedSurah.englishNameTranslation}
              </p>
            </div>

            <div className="arabic-name">{selectedSurah.name}</div>

            <div className="detail-metrics">
              <article>
                <span>Number</span>
                <strong>{selectedSurah.number}</strong>
              </article>
              <article>
                <span>Ayahs</span>
                <strong>{selectedSurah.numberOfAyahs}</strong>
              </article>
              <article>
                <span>Revelation</span>
                <strong>{selectedSurah.revelationType}</strong>
              </article>
            </div>

            {isReading ? (
              <div className="reader-status">Loading Arabic and English ayahs...</div>
            ) : null}

            {readerError ? (
              <div className="reader-status error">{readerError}</div>
            ) : null}

            {!isReading && !readerError ? (
              <div className="ayah-list">
                {selectedSurahAyahs.map((ayah) => (
                  <article key={ayah.numberInSurah} className="ayah-card">
                    <div className="ayah-meta">Ayah {ayah.numberInSurah}</div>
                    <p className="ayah-arabic" dir="rtl" lang="ar">
                      {ayah.arabic}
                    </p>
                    <p className="ayah-english">{ayah.english}</p>
                  </article>
                ))}
              </div>
            ) : null}
          </>
        ) : null}
      </section>
    </main>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/surah/:surahNumber" element={<ReaderPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App

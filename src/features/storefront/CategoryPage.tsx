import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { BRAND_LIST, PRODUCTS, findCategory } from './data/products'
import { PRICE_BUCKETS, filterProducts, type PriceBucket, type SortValue } from './filter'
import { getSubcategories } from './subcategories'
import ProductCard from './ProductCard'

export default function CategoryPage() {
  const navigate = useNavigate()
  const { slug = 'todas' } = useParams()
  const [searchParams] = useSearchParams()
  const search = searchParams.get('q') || ''
  const activeCategory = search ? 'all' : slug === 'todas' ? 'all' : slug

  const [priceBucket, setPriceBucket] = useState<PriceBucket>('all')
  const [brand, setBrand] = useState('all')
  const [personalizableOnly, setPersonalizableOnly] = useState(false)
  const [sort, setSort] = useState<SortValue>('relevance')
  const [sub, setSub] = useState('all')

  const category = findCategory(activeCategory)
  const title = search ? `Resultados para "${search}"` : category ? category.name : 'Todas las categorías'
  const subcategories = useMemo(() => getSubcategories(activeCategory), [activeCategory])

  useEffect(() => {
    setSub('all')
  }, [activeCategory])

  const baseList = useMemo(
    () =>
      filterProducts(PRODUCTS, {
        search,
        category: activeCategory,
        priceBucket,
        brand,
        personalizableOnly,
        sort,
      }),
    [search, activeCategory, priceBucket, brand, personalizableOnly, sort],
  )

  const list = useMemo(() => {
    if (sub === 'all') return baseList
    const rule = subcategories.find((s) => s.slug === sub)
    return rule ? baseList.filter(rule.test) : baseList
  }, [baseList, sub, subcategories])

  const showBrandFilter = activeCategory === 'filamentos' && !search
  const showSubFilter = subcategories.length > 0 && !search

  return (
    <div className="sf-section">
      <div className="sf-breadcrumb">
        <button type="button" className="sf-breadcrumb__link" onClick={() => navigate('/')}>
          Inicio
        </button>
        {' / '}
        <span className="sf-breadcrumb__current">{title}</span>
      </div>

      <div className="sf-category">
        <aside className="sf-filters">
          {showSubFilter && (
            <div>
              <div className="sf-filters__heading">{category ? category.name : 'Subcategorías'}</div>
              <div className="sf-filters__list">
                <button
                  type="button"
                  className={`sf-filters__item ${sub === 'all' ? 'sf-filters__item--active' : ''}`}
                  onClick={() => setSub('all')}
                >
                  Todas
                </button>
                {subcategories.map((s) => (
                  <button
                    key={s.slug}
                    type="button"
                    className={`sf-filters__item ${sub === s.slug ? 'sf-filters__item--active' : ''}`}
                    onClick={() => setSub(s.slug)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="sf-filters__heading">Precio</div>
            <div className="sf-filters__list">
              {PRICE_BUCKETS.map((b) => (
                <button
                  key={b.key}
                  type="button"
                  className={`sf-filters__item ${priceBucket === b.key ? 'sf-filters__item--active' : ''}`}
                  onClick={() => setPriceBucket(b.key)}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          {showBrandFilter && (
            <div>
              <div className="sf-filters__heading">Marca</div>
              <div className="sf-filters__list">
                <button
                  type="button"
                  className={`sf-filters__item ${brand === 'all' ? 'sf-filters__item--active' : ''}`}
                  onClick={() => setBrand('all')}
                >
                  Todas
                </button>
                {BRAND_LIST.map((b) => (
                  <button
                    key={b.slug}
                    type="button"
                    className={`sf-filters__item ${brand === b.slug ? 'sf-filters__item--active' : ''}`}
                    onClick={() => setBrand(b.slug)}
                  >
                    {b.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <label className="sf-filters__checkbox">
            <input
              type="checkbox"
              checked={personalizableOnly}
              onChange={(e) => setPersonalizableOnly(e.target.checked)}
            />
            Personalizable
          </label>
        </aside>

        <div>
          <div className="sf-results-bar">
            <span className="sf-muted" style={{ fontSize: '0.9rem' }}>
              {list.length} resultado{list.length === 1 ? '' : 's'}
            </span>
            <select
              className="sf-input"
              style={{ width: 'auto' }}
              value={sort}
              onChange={(e) => setSort(e.target.value as SortValue)}
            >
              <option value="relevance">Relevancia</option>
              <option value="price-asc">Menor precio</option>
              <option value="price-desc">Mayor precio</option>
            </select>
          </div>

          {list.length > 0 ? (
            <div className="sf-product-grid" style={{ marginTop: '1.25rem' }}>
              {list.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          ) : (
            <div className="sf-empty sf-muted">No encontramos productos con estos filtros.</div>
          )}
        </div>
      </div>
    </div>
  )
}

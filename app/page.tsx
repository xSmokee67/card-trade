'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const CATEGories = [
  { id: 'all', label: 'Wszystkie' },
  { id: 'elixir', label: 'Elixir' },
  { id: 'builder_base', label: 'Builder Base' },
  { id: 'dark_elixir', label: 'Dark Elixir' },
  { id: 'super_troops', label: 'Super Troops' },
];

export default function Home() {
  const [cards, setCards] = useState<any[]>([]);
  const [userStatuses, setUserStatuses] = useState<{ [key: number]: string }>({});
  const [nickname, setNickname] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [cardMarket, setCardMarket] = useState<{ [key: number]: { need: string[], have: string[] } }>({});
  const [selectedCategory, setSelectedCategory] = useState('all');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (nickname.trim()) {
      setIsLoggedIn(true);
      localStorage.setItem('trade_nickname', nickname.trim());
    }
  };

  useEffect(() => {
    const savedName = localStorage.getItem('trade_nickname');
    if (savedName) {
      setNickname(savedName);
      setIsLoggedIn(true);
    }
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;

    async function fetchData() {
      const { data: cardsData } = await supabase.from('cards').select('*');
      if (cardsData) setCards(cardsData);

      const { data: userCardsData } = await supabase
        .from('user_cards')
        .select('*')
        .eq('user_id', nickname);

      if (userCardsData) {
        const statusMap: { [key: number]: string } = {};
        userCardsData.forEach((uc: any) => {
          statusMap[uc.card_id] = uc.status;
        });
        setUserStatuses(statusMap);
      }

      const { data: allUsersCards } = await supabase
        .from('user_cards')
        .select('*');

      if (allUsersCards) {
        const market: { [key: number]: { need: string[], have: string[] } } = {};
        
        allUsersCards.forEach((uc: any) => {
          if (!market[uc.card_id]) {
            market[uc.card_id] = { need: [], have: [] };
          }
          if (uc.status === 'need') {
            market[uc.card_id].need.push(uc.user_id);
          } else if (uc.status === 'have') {
            market[uc.card_id].have.push(uc.user_id);
          }
        });

        setCardMarket(market);
      }
    }
    fetchData();
  }, [isLoggedIn, nickname, userStatuses]);

  const handleCardAction = async (cardId: number, status: string) => {
    const newStatus = userStatuses[cardId] === status ? null : status;

    if (newStatus === null) {
      await supabase.from('user_cards').delete().match({ user_id: nickname, card_id: cardId });
      setUserStatuses((prev) => {
        const copy = { ...prev };
        delete copy[cardId];
        return copy;
      });
    } else {
      await supabase.from('user_cards').upsert(
        { user_id: nickname, card_id: cardId, status: newStatus },
        { onConflict: 'user_id,card_id' }
      );
      setUserStatuses((prev) => ({ ...prev, [cardId]: newStatus }));
    }
  };

  // Filtrowanie kart po wybranej kategorii
  const filteredCards = selectedCategory === 'all' 
    ? cards 
    : cards.filter(card => card.category === selectedCategory);

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <form onSubmit={handleLogin} className="bg-gray-900 border border-gray-800 p-8 rounded-2xl max-w-md w-full shadow-xl">
          <h1 className="text-2xl font-bold text-white mb-2">Wymiana Kart CoC</h1>
          <p className="text-gray-400 text-sm mb-6">Wpisz swój pseudonim w grze, aby rozpocząć:</p>
          <input
            type="text"
            placeholder="Twój Nick / ID"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="w-full bg-gray-950 border border-gray-800 text-white px-4 py-3 rounded-xl mb-4 focus:outline-none focus:border-blue-500"
            required
          />
          <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-500 transition">
            Wejdź do aplikacji
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="p-8 font-sans max-w-6xl mx-auto text-white">
      <div className="flex justify-between items-center mb-8 bg-gray-900 p-4 rounded-xl border border-gray-800">
        <h1 className="text-2xl font-bold">Wymiana Kart - Giełda</h1>
        <div className="text-gray-400 text-sm">
          Zalogowany: <span className="text-white font-bold">{nickname}</span>
          <button 
            onClick={() => { setIsLoggedIn(false); localStorage.removeItem('trade_nickname'); }}
            className="ml-4 text-xs bg-red-950 text-red-400 border border-red-900 px-3 py-1 rounded-lg hover:bg-red-900"
          >
            Wyloguj
          </button>
        </div>
      </div>

      {/* Pasek kategorii (Zakładki) */}
      <div className="flex flex-wrap gap-2 mb-8">
        {CATEGories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-4 py-2 rounded-xl font-medium text-sm transition ${
              selectedCategory === cat.id
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
                : 'bg-gray-900 text-gray-400 border border-gray-800 hover:bg-gray-800 hover:text-white'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Katalog kart */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCards.map((card) => {
          const currentStatus = userStatuses[card.id];
          const cardData = cardMarket[card.id] || { need: [], have: [] };

          return (
            <div key={card.id} className="border border-gray-800 p-5 rounded-xl shadow-lg bg-gray-900 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-xl font-bold">{card.name}</h3>
                  <span className="text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded uppercase">
                    {card.category || 'Inne'}
                  </span>
                </div>
                <p className="text-gray-400 text-sm mb-4">Zestaw: {card.set_name || 'Brak'}</p>

                {/* Giełda dla danej karty */}
                <div className="mb-5 bg-gray-950/60 p-3 rounded-lg border border-gray-800/80 text-xs space-y-2">
                  <div>
                    <span className="text-green-400 font-semibold">🟢 Mają na wymianę:</span>{' '}
                    {cardData.have.length > 0 ? (
                      <span className="text-gray-300">{cardData.have.join(', ')}</span>
                    ) : (
                      <span className="text-gray-600 italic">nikt</span>
                    )}
                  </div>
                  <div>
                    <span className="text-red-400 font-semibold">🔴 Szukają karty:</span>{' '}
                    {cardData.need.length > 0 ? (
                      <span className="text-gray-300">{cardData.need.join(', ')}</span>
                    ) : (
                      <span className="text-gray-600 italic">nikt</span>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Przyciski */}
              <div className="flex flex-col gap-2">
                <button 
                  onClick={() => handleCardAction(card.id, 'need')}
                  className={`py-2 rounded-lg border text-sm transition ${
                    currentStatus === 'need' 
                      ? 'bg-red-600 text-white border-red-500 font-bold' 
                      : 'bg-red-950/40 text-red-400 border-red-900 hover:bg-red-900/40'
                  }`}
                >
                  {currentStatus === 'need' ? '✓ Potrzebuję tej karty' : 'Potrzebuję'}
                </button>
                <button 
                  onClick={() => handleCardAction(card.id, 'have')}
                  className={`py-2 rounded-lg border text-sm transition ${
                    currentStatus === 'have' 
                      ? 'bg-green-600 text-white border-green-500 font-bold' 
                      : 'bg-green-950/40 text-green-400 border-green-900 hover:bg-green-900/40'
                  }`}
                >
                  {currentStatus === 'have' ? '✓ Mam na wymianę' : 'Mam na wymianę'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
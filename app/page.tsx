'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function Home() {
  const [cards, setCards] = useState<any[]>([]);
  const [userStatuses, setUserStatuses] = useState<{ [key: number]: string }>({});
  const [nickname, setNickname] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [matches, setMatches] = useState<any[]>([]);

  // Logowanie po pseudonime
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
      // 1. Pobierz karty
      const { data: cardsData } = await supabase.from('cards').select('*');
      if (cardsData) setCards(cardsData);

      // 2. Pobierz statusy użytkownika
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

      // 3. Matchmaking: Znajdź graczy, którzy mają to, czego Ty szukasz, i szukają tego, co Ty masz
      const myNeeds = userCardsData?.filter(uc => uc.status === 'need').map(uc => uc.card_id) || [];
      const myHaves = userCardsData?.filter(uc => uc.status === 'have').map(uc => uc.card_id) || [];

      if (myNeeds.length > 0 || myHaves.length > 0) {
        const { data: allUsersCards } = await supabase
          .from('user_cards')
          .select('*')
          .neq('user_id', nickname);

        if (allUsersCards) {
          // Znajdź graczy, którzy mają karty, których Ty potrzebujesz
          const potentialMatches = allUsersCards.filter(uc => 
            (uc.status === 'have' && myNeeds.includes(uc.card_id)) ||
            (uc.status === 'need' && myHaves.includes(uc.card_id))
          );
          setMatches(potentialMatches);
        }
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

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <form onSubmit={handleLogin} className="bg-gray-900 border border-gray-800 p-8 rounded-2xl max-w-md w-full shadow-xl">
          <h1 className="text-2xl font-bold text-white mb-2">Wymiana Kart</h1>
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
    <div className="p-8 font-sans max-w-5xl mx-auto text-white">
      <div className="flex justify-between items-center mb-8 bg-gray-900 p-4 rounded-xl border border-gray-800">
        <h1 className="text-2xl font-bold">Wymiana Kart</h1>
        <div className="text-gray-400">
          Zalogowany jako: <span className="text-white font-bold">{nickname}</span>
          <button 
            onClick={() => { setIsLoggedIn(false); localStorage.removeItem('trade_nickname'); }}
            className="ml-4 text-xs bg-red-950 text-red-400 border border-red-900 px-3 py-1 rounded-lg hover:bg-red-900"
          >
            Wyloguj
          </button>
        </div>
      </div>

      {matches.length > 0 && (
        <div className="mb-10 bg-blue-950/30 border border-blue-900/50 p-6 rounded-2xl">
          <h2 className="text-xl font-bold text-blue-400 mb-3">🔥 Znaleziono potencjalne wymiany!</h2>
          <p className="text-sm text-gray-300 mb-4">Inni gracze posiadają karty, których szukasz lub szukają Twoich duplikatów:</p>
          <div className="flex flex-col gap-2">
            {matches.map((m, idx) => (
              <div key={idx} className="bg-gray-900 p-3 rounded-lg border border-gray-800 flex justify-between items-center text-sm">
                <span>Gracz <strong className="text-white">{m.user_id}</strong> ma status: <span className="text-yellow-400 uppercase">{m.status}</span> dla karty ID: {m.card_id}</span>
                <span className="text-xs text-gray-500">Skontaktuj się w grze</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <h2 className="text-xl font-semibold mb-4">Katalog wszystkich kart</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) => {
          const currentStatus = userStatuses[card.id];

          return (
            <div key={card.id} className="border border-gray-800 p-5 rounded-xl shadow-sm bg-gray-900">
              <h3 className="text-xl font-bold">{card.name}</h3>
              <p className="text-gray-400 text-sm mb-4">Zestaw: {card.set_name || 'Brak'}</p>
              
              <div className="flex flex-col gap-2">
                <button 
                  onClick={() => handleCardAction(card.id, 'need')}
                  className={`py-2 rounded-lg border transition ${
                    currentStatus === 'need' 
                      ? 'bg-red-600 text-white border-red-500 font-bold' 
                      : 'bg-red-950/40 text-red-400 border-red-900 hover:bg-red-900/40'
                  }`}
                >
                  {currentStatus === 'need' ? '✓ Potrzebuję' : 'Potrzebuję'}
                </button>
                <button 
                  onClick={() => handleCardAction(card.id, 'have')}
                  className={`py-2 rounded-lg border transition ${
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
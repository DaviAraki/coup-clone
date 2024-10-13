import { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, getDoc } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Toaster } from '@/components/ui/toaster';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

// Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

interface Player {
  id: string;
  name: string;
  coins: number;
  cards: string[];
}

interface Game {
  id: string;
  status: 'waiting' | 'active';
  players: string[];
  currentPlayer: string | null;
}

function App() {
  const [user, setUser] = useState<any>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [currentGame, setCurrentGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [playerName, setPlayerName] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser(user);
      } else {
        signInAnonymously(auth);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const unsubscribe = onSnapshot(collection(db, 'games'), (snapshot) => {
      const updatedGames = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Game[];
      setGames(updatedGames);
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!currentGame) return;

    const unsubscribe = onSnapshot(doc(db, 'games', currentGame.id), (doc) => {
      if (doc.exists()) {
        setCurrentGame(doc.data() as Game);
      }
    });

    return () => unsubscribe();
  }, [currentGame]);

  useEffect(() => {
    if (!currentGame) return;

    const unsubscribe = onSnapshot(collection(db, 'games', currentGame.id, 'players'), (snapshot) => {
      const updatedPlayers = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Player[];
      setPlayers(updatedPlayers);
    });

    return () => unsubscribe();
  }, [currentGame]);

  const createGame = async () => {
    if (!user) return;

    try {
      const gameRef = await addDoc(collection(db, 'games'), {
        status: 'waiting',
        players: [user.uid],
        currentPlayer: null,
      });
      
      await addDoc(collection(db, 'games', gameRef.id, 'players'), {
        id: user.uid,
        name: playerName || `Player ${Math.floor(Math.random() * 1000)}`,
        coins: 2,
        cards: ['Duke', 'Assassin'], // Simplified for demo
      });

      setCurrentGame({ id: gameRef.id, status: 'waiting', players: [user.uid], currentPlayer: null });
      toast({
        title: 'Game Created',
        description: 'Waiting for other players to join',
      });
    } catch (error) {
      console.error("Error creating game:", error);
      toast({
        title: 'Error',
        description: 'Failed to create the game. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const joinGame = async (gameId: string) => {
    if (!user) return;

    try {
      const gameRef = doc(db, 'games', gameId);
      const gameSnap = await getDoc(gameRef);

      if (gameSnap.exists()) {
        const gameData = gameSnap.data() as Game;
        if (gameData.status === 'waiting' && !gameData.players.includes(user.uid)) {
          await updateDoc(gameRef, {
            players: [...gameData.players, user.uid],
          });

          await addDoc(collection(db, 'games', gameId, 'players'), {
            id: user.uid,
            name: playerName || `Player ${Math.floor(Math.random() * 1000)}`,
            coins: 2,
            cards: ['Duke', 'Assassin'], // Simplified for demo
          });

          setCurrentGame({ ...gameData, id: gameId, players: [...gameData.players, user.uid] });
          toast({
            title: 'Joined Game',
            description: 'You have successfully joined the game',
          });
        } else {
          toast({
            title: 'Cannot Join',
            description: 'This game is either full or already started',
            variant: 'destructive',
          });
        }
      }
    } catch (error) {
      console.error("Error joining game:", error);
      toast({
        title: 'Error',
        description: 'Failed to join the game. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const startGame = async () => {
    if (!currentGame) return;

    try {
      await updateDoc(doc(db, 'games', currentGame.id), {
        status: 'active',
        currentPlayer: currentGame.players[0],
      });
      toast({
        title: 'Game Started',
        description: `It's ${players[0].name}'s turn`,
      });
    } catch (error) {
      console.error("Error starting game:", error);
      toast({
        title: 'Error',
        description: 'Failed to start the game. Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-4xl font-bold mb-8">Coup Clone</h1>
      {!currentGame ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Create Game</CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                placeholder="Enter your name"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="mb-2"
              />
              <Button onClick={createGame}>Create New Game</Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Join Game</CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                placeholder="Enter your name"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="mb-2"
              />
              {games.filter(game => game.status === 'waiting').map((game) => (
                <Button key={game.id} onClick={() => joinGame(game.id)} className="mr-2 mb-2">
                  Join Game {game.id.slice(0, 4)}
                </Button>
              ))}
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Players</CardTitle>
            </CardHeader>
            <CardContent>
              {players.map((player) => (
                <div key={player.id} className="flex items-center space-x-4 mb-2">
                  <Avatar>
                    <AvatarImage src={`https://api.dicebear.com/6.x/initials/svg?seed=${player.name}`} />
                    <AvatarFallback>{player.name[0]}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold">{player.name}</p>
                    <p className="text-sm text-gray-500">{player.coins} coins</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Game Controls</CardTitle>
            </CardHeader>
            <CardContent>
              {currentGame.status === 'waiting' ? (
                <Button onClick={startGame} disabled={players.length < 2}>
                  Start Game
                </Button>
              ) : (
                <p>Game in progress</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
      <Dialog>
        <DialogTrigger asChild>
          <Button className="mt-4">How to Play</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>How to Play Coup</DialogTitle>
          </DialogHeader>
          <div className="mt-2">
            <p>1. Each player starts with 2 coins and 2 influence cards.</p>
            <p>2. On your turn, you must take one of these actions:</p>
            <ul className="list-disc list-inside">
              <li>Income: Take 1 coin from the treasury</li>
              <li>Foreign Aid: Take 2 coins (can be blocked by the Duke)</li>
              <li>Coup: Pay 7 coins and choose a player to lose an influence</li>
              <li>Duke: Take 3 coins from the treasury</li>
              <li>Assassin: Pay 3 coins to make a player lose an influence</li>
              <li>Captain: Steal 2 coins from another player</li>
              <li>Ambassador: Exchange cards with the Court deck</li>
            </ul>
            <p>3. Players can challenge or block actions.</p>
            <p>4. The last player with influence (cards) wins!</p>
          </div>
        </DialogContent>
      </Dialog>
      <Toaster />
    </div>
  );
}

export default App;
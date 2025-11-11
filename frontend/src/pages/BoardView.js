import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card } from "../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Edit3 } from "lucide-react";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function BoardView() {
  const { boardId } = useParams();
  const navigate = useNavigate();
  const [board, setBoard] = useState(null);
  const [lists, setLists] = useState([]);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newListTitle, setNewListTitle] = useState("");
  const [selectedCard, setSelectedCard] = useState(null);
  const [showCardDialog, setShowCardDialog] = useState(false);
  const [newCardData, setNewCardData] = useState({ title: "", listId: "" });
  const [showNewCardDialog, setShowNewCardDialog] = useState(false);

  useEffect(() => {
    fetchBoardData();
  }, [boardId]);

  const fetchBoardData = async () => {
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      const [boardRes, listsRes, cardsRes] = await Promise.all([
        axios.get(`${API}/boards/${boardId}`, { headers }),
        axios.get(`${API}/lists/${boardId}`, { headers }),
        axios.get(`${API}/cards/${boardId}`, { headers }),
      ]);

      setBoard(boardRes.data);
      setLists(listsRes.data);
      setCards(cardsRes.data);
    } catch {
      toast.error("Failed to load board data");
    } finally {
      setLoading(false);
    }
  };

  const createList = async () => {
    if (!newListTitle.trim()) return;

    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `${API}/boards/${boardId}/lists`,
        { title: newListTitle, board_id: boardId, position: lists.length },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setNewListTitle("");
      fetchBoardData();
      toast.success("List created!");
    } catch {
      toast.error("Failed to create list");
    }
  };

  const createCard = (listId) => {
    setNewCardData({ title: "", listId });
    setShowNewCardDialog(true);
  };

  const handleCreateCard = async () => {
    if (!newCardData.title.trim()) {
      toast.error("Card title is required");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      const listCards = cards.filter((c) => c.list_id === newCardData.listId);

      await axios.post(
        `${API}/lists/${newCardData.listId}/cards`,
        {
          title: newCardData.title,
          description: "",
          list_id: newCardData.listId,
          board_id: boardId,
          position: listCards.length,
        },
        { headers }
      );

      await fetchBoardData();
      setShowNewCardDialog(false);
      setNewCardData({ title: "", listId: "" });
      toast.success("Card created!");
    } catch {
      toast.error("Failed to create card");
    }
  };

  const deleteCard = async (cardId) => {
    if (!window.confirm("Delete this card?")) return;

    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${API}/cards/${cardId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchBoardData();
      setShowCardDialog(false);
      toast.success("Card deleted");
    } catch {
      toast.error("Failed to delete card");
    }
  };

  const updateCard = async (cardId, updates) => {
    try {
      const token = localStorage.getItem("token");
      await axios.put(`${API}/cards/${cardId}`, updates, {
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchBoardData();
      toast.success("Card updated");
    } catch {
      toast.error("Failed to update card");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-blue-800 font-medium">
        Loading board...
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: board?.background || "#e3f2fd" }}>
      {/* Header */}
      <header className="backdrop-blur-md bg-white/70 shadow-sm p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between max-w-7xl mx-auto gap-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              onClick={() => navigate("/dashboard")}
              className="text-blue-700 hover:text-blue-900"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-blue-900">{board?.title}</h1>
              {board?.description && (
                <p className="text-sm text-blue-700 mt-1">{board.description}</p>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Board Content */}
      <div className="p-4 sm:p-6 overflow-x-auto">
        <div
          className="flex flex-wrap md:flex-nowrap gap-4 md:gap-6 min-h-[calc(100vh-200px)]"
          data-testid="board-lists"
        >
          {lists.map((list) => {
            const listCards = cards.filter((c) => c.list_id === list.id);
            return (
              <div
                key={list.id}
                className="flex-shrink-0 w-full sm:w-80 backdrop-blur-md bg-white/80 rounded-lg p-4 shadow-lg"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-lg text-blue-900">{list.title}</h3>
                  <span className="text-sm px-2 py-1 rounded bg-blue-100 text-blue-900">
                    {listCards.length}
                  </span>
                </div>

                <div className="space-y-3 mb-3">
                  {listCards.map((card) => (
                    <Card
                      key={card.id}
                      className="p-3 cursor-pointer border-2 hover:shadow-md"
                      style={{ borderColor: "#b3e5fc" }}
                      onClick={() => {
                        setSelectedCard(card);
                        setShowCardDialog(true);
                      }}
                    >
                      <h4 className="font-medium text-blue-900 mb-1">{card.title}</h4>
                      {card.description && (
                        <p className="text-sm text-blue-700 line-clamp-2">{card.description}</p>
                      )}
                    </Card>
                  ))}
                </div>

                <Button
                  variant="outline"
                  className="w-full border-2 text-blue-700 border-blue-400 hover:bg-blue-50"
                  onClick={() => createCard(list.id)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Card
                </Button>
              </div>
            );
          })}

          {/* New List */}
          <div className="flex-shrink-0 w-full sm:w-80 backdrop-blur-md bg-white/70 rounded-lg p-4">
            <Input
              placeholder="Enter list title..."
              value={newListTitle}
              onChange={(e) => setNewListTitle(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && createList()}
              className="mb-2 border-2"
            />
            <Button
              onClick={createList}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add List
            </Button>
          </div>
        </div>
      </div>

      {/* Card Detail Dialog */}
      <Dialog open={showCardDialog} onOpenChange={setShowCardDialog}>
        <DialogContent className="max-w-xl sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl sm:text-2xl text-blue-900">
              {selectedCard?.title}
            </DialogTitle>
          </DialogHeader>
          {selectedCard && (
            <div className="space-y-4 mt-4">
              <div>
                <Label>Description</Label>
                <Textarea
                  value={selectedCard.description || ""}
                  onChange={(e) =>
                    setSelectedCard({ ...selectedCard, description: e.target.value })
                  }
                  placeholder="Add a description..."
                  rows={4}
                  className="mt-1"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={() =>
                    updateCard(selectedCard.id, { description: selectedCard.description })
                  }
                  className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto"
                >
                  <Edit3 className="w-4 h-4 mr-2" />
                  Update Card
                </Button>

                <Button
                  variant="destructive"
                  onClick={() => deleteCard(selectedCard.id)}
                  className="w-full sm:w-auto"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Card
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* New Card Dialog */}
      <Dialog open={showNewCardDialog} onOpenChange={setShowNewCardDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Card</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Card Title</Label>
              <Input
                placeholder="Enter card title..."
                value={newCardData.title}
                onChange={(e) => setNewCardData({ ...newCardData, title: e.target.value })}
                onKeyPress={(e) => e.key === "Enter" && handleCreateCard()}
              />
            </div>
            <Button
              onClick={handleCreateCard}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              Create Card
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

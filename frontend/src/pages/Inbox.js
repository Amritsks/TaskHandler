import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Sparkles, Plus } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";

const BACKEND_URL =
  process.env.REACT_APP_BACKEND_URL || "http://127.0.0.1:8000";
const API = `${BACKEND_URL}/api`;

export default function Inbox() {
  const navigate = useNavigate();
  const [cards, setCards] = useState([]);
  const [boards, setBoards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAIConverter, setShowAIConverter] = useState(false);
  const [inputText, setInputText] = useState("");
  const [extractedTasks, setExtractedTasks] = useState([]);
  const [selectedBoard, setSelectedBoard] = useState("");
  const [extracting, setExtracting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  // ✅ Fetch cards + boards for inbox view
  const fetchData = async () => {
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      const [cardsRes, boardsRes] = await Promise.all([
        axios.get(`${API}/inbox`, { headers }),
        axios.get(`${API}/boards`, { headers }),
      ]);

      const cardsData = Array.isArray(cardsRes.data) ? cardsRes.data : [];
      const boardsData = Array.isArray(boardsRes.data) ? boardsRes.data : [];

      setCards(cardsData);
      setBoards(boardsData);
    } catch (error) {
      console.error("Inbox fetch error:", error);
      toast.error("Failed to load inbox");
      setCards([]);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Use AI to extract tasks from text
  const extractTasks = async () => {
    if (!inputText.trim()) {
      toast.error("Please enter some text");
      return;
    }

    setExtracting(true);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `${API}/ai/extract-tasks`,
        { text: inputText },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const tasks = Array.isArray(response.data.tasks)
        ? response.data.tasks
        : [];
      setExtractedTasks(tasks);
      toast.success("Tasks extracted! Review and select a board to add them.");
    } catch {
      toast.error("Failed to extract tasks");
    } finally {
      setExtracting(false);
    }
  };

  // ✅ Add extracted tasks as cards to the first list of selected board
  const addTasksToBoard = async () => {
    if (!selectedBoard) {
      toast.error("Please select a board");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      const listsRes = await axios.get(`${API}/lists/${selectedBoard}`, {
        headers,
      });
      const lists = Array.isArray(listsRes.data) ? listsRes.data : [];

      if (lists.length === 0) {
        toast.error("This board has no lists. Create a list first.");
        return;
      }

      const firstList = lists[0];

      const cardsRes = await axios.get(`${API}/cards/${selectedBoard}`, {
        headers,
      });
      const existingCards = Array.isArray(cardsRes.data)
        ? cardsRes.data
        : [];
      let position = existingCards.filter(
        (c) => c.list_id === firstList.id
      ).length;

      for (const task of extractedTasks) {
        if (!firstList?.id || !selectedBoard) continue;

        try {
          await axios.post(
            `${API}/lists/${firstList.id}/cards`,
            {
              title: task.title || "Untitled Task",
              description: task.description || "",
              list_id: firstList.id,
              board_id: selectedBoard.id || selectedBoard,
              position: position++,
              priority: task.priority || "medium",
            },
            { headers }
          );
        } catch (err) {
          console.error("❌ Failed to add task:", err.response?.data);
        }
      }

      toast.success(`${extractedTasks.length} task(s) added to board!`);
      setShowAIConverter(false);
      setInputText("");
      setExtractedTasks([]);
      setSelectedBoard("");
      fetchData();
    } catch (error) {
      console.error("Card creation error:", error);
      toast.error("Failed to add tasks");
    }
  };

  return (
    <div
      className="min-h-screen w-full bg-gradient-to-br from-[#e3f2fd] to-[#f0f4f8]"
    >
      {/* Header */}
      <header className="backdrop-blur-md bg-white/70 shadow-sm p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 max-w-7xl mx-auto">
          {/* Back & Title */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            <Button
              variant="ghost"
              onClick={() => navigate("/dashboard")}
              className="flex items-center text-[#0277bd] text-sm sm:text-base"
            >
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" />
              Back
            </Button>
            <h1 className="text-xl sm:text-2xl font-bold text-[#01579b]">
              Unified Inbox
            </h1>
          </div>

          {/* AI Task Converter */}
          <Dialog open={showAIConverter} onOpenChange={setShowAIConverter}>
            <DialogTrigger asChild>
              <Button
                className="w-full sm:w-auto text-white text-sm sm:text-base"
                style={{ background: "#0288d1" }}
              >
                <Sparkles className="w-4 h-4 mr-2" />
                AI Task Converter
              </Button>
            </DialogTrigger>
            <DialogContent
              aria-describedby="task-dialog-desc"
              className="max-w-lg sm:max-w-2xl"
            >
              <DialogHeader>
                <DialogTitle>Convert Text to Tasks</DialogTitle>
              </DialogHeader>

              <div id="task-dialog-desc" className="space-y-4 mt-4">
                <Label>Paste your text below</Label>
                <Textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  rows={6}
                  placeholder="Paste your email or message here..."
                />
                <Button
                  onClick={extractTasks}
                  disabled={extracting}
                  className="w-full text-white"
                  style={{ background: "#0288d1" }}
                >
                  {extracting ? "Extracting..." : "Extract Tasks"}
                </Button>

                {extractedTasks.length > 0 && (
                  <div className="space-y-3">
                    <div>
                      <Label>Extracted Tasks ({extractedTasks.length})</Label>
                      <div className="space-y-2 mt-2 max-h-52 sm:max-h-60 overflow-y-auto">
                        {extractedTasks.map((task, i) => (
                          <Card key={i} className="p-3">
                            <h4 className="font-medium text-[#01579b]">
                              {task.title}
                            </h4>
                            {task.description && (
                              <p className="text-sm text-[#0277bd]">
                                {task.description}
                              </p>
                            )}
                          </Card>
                        ))}
                      </div>
                    </div>

                    <div>
                      <Label>Select Board</Label>
                      <Select
                        value={selectedBoard}
                        onValueChange={setSelectedBoard}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a board" />
                        </SelectTrigger>
                        <SelectContent>
                          {boards.map((b) => (
                            <SelectItem key={b.id} value={b.id}>
                              {b.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <Button
                      onClick={addTasksToBoard}
                      className="w-full text-white"
                      style={{ background: "#0288d1" }}
                    >
                      <Plus className="w-4 h-4 mr-2" /> Add to Board
                    </Button>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {/* ✅ Inbox Content */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-6 sm:py-10">
        {loading ? (
          <p className="text-center text-[#0277bd] text-sm sm:text-base">
            Loading your tasks...
          </p>
        ) : cards.length === 0 ? (
          <div className="text-center py-10 sm:py-16">
            <Sparkles
              className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4"
              style={{ color: "#0288d1", opacity: 0.5 }}
            />
            <p className="text-base sm:text-lg text-[#0277bd]">
              No tasks yet. Create some in your boards!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {cards.map((card) => (
              <Card
                key={card.id}
                className="border-2 border-[#b3e5fc] hover:shadow-md transition-shadow"
              >
                <CardHeader>
                  <CardTitle className="text-[#01579b] text-lg sm:text-xl">
                    {card.title}
                  </CardTitle>
                </CardHeader>
                {card.description && (
                  <CardContent>
                    <p className="text-[#0277bd] text-sm sm:text-base">
                      {card.description}
                    </p>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

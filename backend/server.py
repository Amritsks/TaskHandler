from fastapi import FastAPI, APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from starlette.middleware.cors import CORSMiddleware
import os
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List as ListType, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt

# ------------------ ENV & DATABASE ------------------ #
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ.get("MONGO_URL", "mongodb://127.0.0.1:27017")
db_name = os.environ.get("DB_NAME", "flexflow")

client = AsyncIOMotorClient(mongo_url)
db = client[db_name]

# ------------------ APP SETUP ------------------ #
app = FastAPI(title="FlexFlow Backend API")
api_router = APIRouter(prefix="/api")

security = HTTPBearer()

# JWT Config
JWT_SECRET = os.environ.get("JWT_SECRET", "supersecret")
JWT_ALGORITHM = os.environ.get("JWT_ALGORITHM", "HS256")
JWT_EXPIRATION = int(os.environ.get("JWT_EXPIRATION_HOURS", "168"))


# ------------------ MODELS ------------------ #
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    name: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class UserCreate(BaseModel):
    email: EmailStr
    name: str
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    token: str
    user: User


class Board(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: Optional[str] = None
    owner_id: str
    members: ListType[str] = Field(default_factory=list)
    background: Optional[str] = "#e0f7fa"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class BoardCreate(BaseModel):
    title: str
    description: Optional[str] = None
    background: Optional[str] = "#e0f7fa"


class List(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    board_id: str
    position: int
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ListCreate(BaseModel):
    title: str
    board_id: str
    position: int


class Card(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: Optional[str] = None
    list_id: str
    board_id: str
    position: int
    assigned_to: Optional[ListType[str]] = Field(default_factory=list)
    labels: ListType[str] = Field(default_factory=list)
    due_date: Optional[datetime] = None
    priority: Optional[str] = "medium"
    custom_fields: Dict[str, Any] = Field(default_factory=dict)
    mirrored_to: ListType[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class CardCreate(BaseModel):
    title: str
    description: Optional[str] = None
    list_id: str
    board_id: str
    position: int
    assigned_to: Optional[ListType[str]] = Field(default_factory=list)
    labels: Optional[ListType[str]] = Field(default_factory=list)
    due_date: Optional[datetime] = None
    priority: Optional[str] = "medium"
    custom_fields: Optional[Dict[str, Any]] = Field(default_factory=dict)


class CardUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    list_id: Optional[str] = None
    position: Optional[int] = None
    assigned_to: Optional[ListType[str]] = None
    labels: Optional[ListType[str]] = None
    due_date: Optional[datetime] = None
    priority: Optional[str] = None
    custom_fields: Optional[Dict[str, Any]] = None


# ------------------ HELPERS ------------------ #
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))


def create_token(user_id: str) -> str:
    payload = {
        "user_id": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> str:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload["user_id"]
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> User:
    token = credentials.credentials
    user_id = decode_token(token)
    user_doc = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if isinstance(user_doc.get("created_at"), str):
        user_doc["created_at"] = datetime.fromisoformat(user_doc["created_at"])
    return User(**user_doc)


# ------------------ AUTH ROUTES ------------------ #
@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(email=user_data.email, name=user_data.name)
    user_dict = user.model_dump()
    user_dict["password"] = hash_password(user_data.password)
    user_dict["created_at"] = user_dict["created_at"].isoformat()

    await db.users.insert_one(user_dict)
    token = create_token(user.id)
    return TokenResponse(token=token, user=user)


@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user_doc = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user_doc or not verify_password(credentials.password, user_doc["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if isinstance(user_doc.get("created_at"), str):
        user_doc["created_at"] = datetime.fromisoformat(user_doc["created_at"])

    user = User(**{k: v for k, v in user_doc.items() if k != "password"})
    token = create_token(user.id)
    return TokenResponse(token=token, user=user)


@api_router.get("/auth/me", response_model=User)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


# ------------------ BOARDS ------------------ #
@api_router.get("/boards", response_model=ListType[Board])
async def get_boards(current_user: User = Depends(get_current_user)):
    return await db.boards.find({"owner_id": current_user.id}, {"_id": 0}).to_list(None)


@api_router.post("/boards", response_model=Board)
async def create_board(board_data: BoardCreate, current_user: User = Depends(get_current_user)):
    board = Board(
        title=board_data.title,
        description=board_data.description,
        owner_id=current_user.id,
        background=board_data.background,
    )
    await db.boards.insert_one(board.model_dump())
    return board


# ✅ New route: Get single board by ID
@api_router.get("/boards/{board_id}", response_model=Board)
async def get_board(board_id: str, current_user: User = Depends(get_current_user)):
    board = await db.boards.find_one({"id": board_id}, {"_id": 0})
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    return board


# ------------------ LISTS ------------------ #
@api_router.get("/boards/{board_id}/lists", response_model=ListType[List])
async def get_lists(board_id: str, current_user: User = Depends(get_current_user)):
    return await db.lists.find({"board_id": board_id}, {"_id": 0}).to_list(None)


@api_router.post("/boards/{board_id}/lists", response_model=List)
async def create_list(board_id: str, list_data: ListCreate, current_user: User = Depends(get_current_user)):
    new_list = List(title=list_data.title, board_id=board_id, position=list_data.position)
    await db.lists.insert_one(new_list.model_dump())
    return new_list


# ✅ New route: Get all lists for a given board
@api_router.get("/lists/{board_id}", response_model=ListType[List])
async def get_lists_by_board(board_id: str, current_user: User = Depends(get_current_user)):
    lists = await db.lists.find({"board_id": board_id}, {"_id": 0}).to_list(None)
    return lists  # ✅ returns [] instead of raising 404



# ------------------ CARDS ------------------ #
@api_router.post("/lists/{list_id}/cards", response_model=Card)
async def create_card(list_id: str, card_data: CardCreate, current_user: User = Depends(get_current_user)):
    print("🔥 Incoming card request:")
    print("🔥 Incoming manual card request:", card_data.model_dump())
    print("list_id:", list_id)
    print("card_data:", card_data.model_dump())

    try:
        card_data_dict = card_data.model_dump()
        card_data_dict["list_id"] = list_id  # overwrite just in case
        card = Card(**card_data_dict)
        await db.cards.insert_one(card.model_dump())
        print("✅ Card created:", card.title)
        return card
    except Exception as e:
        import traceback
        print("❌ Error creating card:", e)
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to create card: {e}")




@api_router.get("/lists/{list_id}/cards", response_model=ListType[Card])
async def get_cards(list_id: str, current_user: User = Depends(get_current_user)):
    return await db.cards.find({"list_id": list_id}, {"_id": 0}).to_list(None)


# ✅ New route: Get all cards for a given board
@api_router.get("/cards/{board_id}", response_model=ListType[Card])
async def get_cards_by_board(board_id: str, current_user: User = Depends(get_current_user)):
    cards = await db.cards.find({"board_id": board_id}, {"_id": 0}).to_list(None)
    return cards  # ✅ return [] instead of raising 404


# ------------------ DELETE CARD ------------------ #
@api_router.delete("/cards/{card_id}")
async def delete_card(card_id: str, current_user: User = Depends(get_current_user)):
    result = await db.cards.delete_one({"id": card_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Card not found")
    return {"message": "Card deleted successfully"}

# ------------------ UPDATE CARD ------------------ #
@api_router.put("/cards/{card_id}", response_model=Card)
async def update_card(card_id: str, updates: CardUpdate, current_user: User = Depends(get_current_user)):
    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc)

    result = await db.cards.find_one_and_update(
        {"id": card_id},
        {"$set": update_data},
        return_document=True
    )

    if not result:
        raise HTTPException(status_code=404, detail="Card not found")

    return result

# ------------------ AI TASK EXTRACTION ------------------ #
@api_router.post("/ai/extract-tasks")
async def extract_tasks_fallback():
    return {
        "tasks": [
            {"title": "Follow up with client", "description": "Send email to confirm project details", "priority": "high"},
            {"title": "Prepare report", "description": "Summarize weekly performance metrics", "priority": "medium"},
            {"title": "Team meeting", "description": "Discuss design updates", "priority": "low"},
        ]
    }


# ------------------ INBOX ------------------ #
@api_router.get("/inbox")
async def get_inbox(current_user: User = Depends(get_current_user)):
    user_boards = await db.boards.find({"owner_id": current_user.id}, {"_id": 0, "id": 1}).to_list(None)
    board_ids = [b["id"] for b in user_boards]
    if not board_ids:
        return []
    cards = await db.cards.find({"board_id": {"$in": board_ids}}, {"_id": 0}).to_list(None)
    return cards


# ------------------ FINAL SETUP ------------------ #
app.include_router(api_router)

# ✅ CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"message": "✅ FlexFlow Backend Running"}

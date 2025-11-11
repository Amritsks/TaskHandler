import { useState } from "react";
import axios from "axios";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { toast } from "sonner";

const BACKEND_URL =
  process.env.REACT_APP_BACKEND_URL || "http://127.0.0.1:8000";
const API = `${BACKEND_URL}/api`;

export default function Login({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const endpoint = isLogin ? `${API}/auth/login` : `${API}/auth/register`;
      const response = await axios.post(endpoint, formData);
      const { token, user } = response.data;

      onLogin(token, user);
      toast.success(isLogin ? "Welcome back!" : "Account created successfully!");
    } catch (error) {
      console.error("Login error:", error);
      toast.error(error.response?.data?.detail || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 sm:p-6 md:p-8 lg:p-10 bg-gradient-to-br from-[#e3f2fd] via-[#b3e5fc] to-[#81d4fa]"
    >
      <Card className="w-full max-w-sm sm:max-w-md md:max-w-lg shadow-2xl rounded-2xl bg-white/90 backdrop-blur-sm transition-transform duration-500 hover:scale-[1.02]">
        <CardHeader className="text-center space-y-2">
          <CardTitle className="text-3xl sm:text-4xl font-bold text-[#0277bd]">
            TaskHandler
          </CardTitle>
          <CardDescription className="text-sm sm:text-base text-gray-600">
            {isLogin ? "Sign in to your account" : "Create a new account"}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  data-testid="name-input"
                  type="text"
                  placeholder="John Doe"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required={!isLogin}
                  className="border-2 focus:border-[#0288d1]"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                data-testid="email-input"
                type="email"
                placeholder="you@example.com"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                required
                className="border-2 focus:border-[#0288d1]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                data-testid="password-input"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                required
                className="border-2 focus:border-[#0288d1]"
              />
            </div>

            <Button
              type="submit"
              data-testid="submit-button"
              className="w-full text-white font-medium py-2 sm:py-3 text-sm sm:text-base"
              style={{ background: "#0288d1" }}
              disabled={loading}
            >
              {loading ? "Loading..." : isLogin ? "Sign In" : "Sign Up"}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <button
              type="button"
              data-testid="toggle-auth-mode"
              onClick={() => setIsLogin(!isLogin)}
              className="text-xs sm:text-sm text-[#0277bd] hover:underline"
            >
              {isLogin
                ? "Don't have an account? Sign up"
                : "Already have an account? Sign in"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

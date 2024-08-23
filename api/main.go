package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/cloudinary/cloudinary-go/v2"
	"github.com/cloudinary/cloudinary-go/v2/api/uploader"
	"github.com/go-redis/redis/v8"
	"github.com/golang-jwt/jwt/v5"
	"github.com/gorilla/mux"
	"github.com/skip2/go-qrcode"
	"golang.org/x/crypto/bcrypt"
)

var redisClient *redis.Client
var jwtKey = []byte("hasanali")
var cloudinaryClient *cloudinary.Cloudinary

type Credentials struct {
	Username string `json:"username"`
	Password string `json:"password"`
	Email    string `json:"email"`
}

type Claims struct {
	Username string `json:"username"`
	jwt.RegisteredClaims
}

type Box struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

type Item struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	ImageURL    string `json:"image_url"`
	Quality     int    `json:"quality"`
	Quantity    int    `json:"quantity"`
}

func init() {
	ctx := context.Background()
	opt, _ := redis.ParseURL("rediss://default:Aes8AAIjcDExMjE2OGQ1ZDIyZDc0NzljOTkyMzgzMjRkYTBkYTBkZXAxMA@live-hare-60220.upstash.io:6379")
	redisClient = redis.NewClient(opt)

	cloudinaryClient, _ = cloudinary.NewFromURL("cloudinary://878192299771434:kriv4PCTIUAU9SORuHG6Eo0NP6U@djl0ogv5q")

	if err := redisClient.Set(ctx, "foo", "bar", 0).Err(); err != nil {
		panic(err)
	}
	val, err := redisClient.Get(ctx, "foo").Result()
	if err != nil {
		panic(err)
	}
	fmt.Printf("Redis test value: %s\n", val)
}

func generateAndUploadQRCode(data string) (string, error) {
	qr, err := qrcode.Encode(data, qrcode.Medium, 256)
	if err != nil {
		return "", err
	}

	tempFile, err := ioutil.TempFile("", "qrcode-*.png")
	if err != nil {
		return "", err
	}
	defer tempFile.Close()

	if _, err := tempFile.Write(qr); err != nil {
		return "", err
	}

	uploadResult, err := cloudinaryClient.Upload.Upload(context.Background(), tempFile.Name(), uploader.UploadParams{Folder: "qr_codes"})
	if err != nil {
		return "", err
	}

	return uploadResult.SecureURL, nil
}

func uploadImageToCloudinary(imageData io.Reader) (string, error) {
	uploadResult, err := cloudinaryClient.Upload.Upload(context.Background(), imageData, uploader.UploadParams{Folder: "items"})
	if err != nil {
		return "", err
	}
	return uploadResult.SecureURL, nil
}

func Register(ctx context.Context, creds *Credentials) error {
	existingUsername, _ := redisClient.Get(ctx, fmt.Sprintf("username:%s", creds.Username)).Result()
	if existingUsername != "" {
		return fmt.Errorf("username already taken")
	}

	existingEmail, _ := redisClient.Get(ctx, fmt.Sprintf("email:%s", creds.Email)).Result()
	if existingEmail != "" {
		return fmt.Errorf("email already in use")
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(creds.Password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	userKey := fmt.Sprintf("user:%s", creds.Email)
	_, err = redisClient.HSet(ctx, userKey, map[string]interface{}{
		"username": creds.Username,
		"email":    creds.Email,
		"password": string(hashedPassword),
	}).Result()

	if err != nil {
		return err
	}

	redisClient.Set(ctx, fmt.Sprintf("username:%s", creds.Username), creds.Email, 0)
	redisClient.Set(ctx, fmt.Sprintf("email:%s", creds.Email), creds.Username, 0)

	return nil
}

func Login(ctx context.Context, creds *Credentials) (string, error) {
	userKey := fmt.Sprintf("user:%s", creds.Email)
	result, err := redisClient.HGetAll(ctx, userKey).Result()
	if err != nil {
		return "", err
	}

	if len(result) == 0 {
		return "", fmt.Errorf("user not found")
	}

	err = bcrypt.CompareHashAndPassword([]byte(result["password"]), []byte(creds.Password))
	if err != nil {
		return "", fmt.Errorf("incorrect password")
	}

	expirationTime := time.Now().Add(24 * time.Hour)
	claims := &Claims{
		Username: creds.Username,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString(jwtKey)
	if err != nil {
		return "", err
	}

	return tokenString, nil
}

func CreateBox(ctx context.Context, tokenString string, box Box) (string, error) {
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		return jwtKey, nil
	})

	if err != nil || !token.Valid {
		return "", fmt.Errorf("unauthorized")
	}

	boxID := fmt.Sprintf("box:%s:%d", claims.Username, time.Now().Unix())
	qrData := fmt.Sprintf(boxID)
	qrCodeURL, err := generateAndUploadQRCode(qrData)
	if err != nil {
		return "", err
	}

	_, err = redisClient.HSet(ctx, boxID, map[string]interface{}{
		"name":        box.Name,
		"description": box.Description,
		"qr_code_url": qrCodeURL,
		"boxId":       boxID,
	}).Result()

	return qrCodeURL, err
}

func GetBoxes(ctx context.Context, tokenString string) ([]map[string]interface{}, error) {
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		return jwtKey, nil
	})

	if err != nil || !token.Valid {
		return nil, fmt.Errorf("unauthorized")
	}

	cursor := uint64(0)
	var boxes []map[string]interface{}

	for {
		keys, nextCursor, err := redisClient.Scan(ctx, cursor, fmt.Sprintf("box:%s:*", claims.Username), 0).Result()
		if err != nil {
			return nil, err
		}
		cursor = nextCursor

		for _, key := range keys {
			keyType, err := redisClient.Type(ctx, key).Result()
			if err != nil {
				return nil, err
			}

			if keyType != "hash" {
				continue
			}

			box, err := redisClient.HGetAll(ctx, key).Result()
			if err != nil {
				return nil, err
			}

			boxID := key[strings.LastIndex(key, ":")+1:]
			box["boxId"] = boxID

			itemKeys, err := redisClient.LRange(ctx, fmt.Sprintf("%s:items", key), 0, -1).Result()
			if err != nil {
				return nil, err
			}

			var items []map[string]interface{}
			for _, itemKey := range itemKeys {
				item, err := redisClient.HGetAll(ctx, itemKey).Result()
				if err != nil {
					return nil, err
				}

				quality, _ := redisClient.HGet(ctx, itemKey, "quality").Int()
				quantity, _ := redisClient.HGet(ctx, itemKey, "quantity").Int()

				itemWithDetails := map[string]interface{}{
					"name":        item["name"],
					"description": item["description"],
					"image_url":   item["image_url"],
					"quality":     quality,
					"quantity":    quantity,
				}

				items = append(items, itemWithDetails)
			}

			boxWithItems := make(map[string]interface{})
			for k, v := range box {
				boxWithItems[k] = v
			}
			boxWithItems["items"] = items

			boxes = append(boxes, boxWithItems)
		}

		if cursor == 0 {
			break
		}
	}

	return boxes, nil
}

func AddItem(ctx context.Context, tokenString string, boxID string, item Item, imageData io.Reader) error {
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		return jwtKey, nil
	})

	if err != nil || !token.Valid {
		return fmt.Errorf("unauthorized")
	}

	boxKey := fmt.Sprintf("box:%s:%s", claims.Username, boxID)
	exists, err := redisClient.Exists(ctx, boxKey).Result()
	if err != nil {
		return err
	}
	if exists == 0 {
		return fmt.Errorf("box not found or not owned by user")
	}

	imageURL, err := uploadImageToCloudinary(imageData)
	if err != nil {
		return err
	}

	itemID := fmt.Sprintf("item:%s:%d", boxID, time.Now().Unix())

	_, err = redisClient.HSet(ctx, itemID, map[string]interface{}{
		"name":        item.Name,
		"description": item.Description,
		"image_url":   imageURL,
		"quality":     item.Quality,
		"quantity":    item.Quantity,
		"box_id":      boxID,
	}).Result()
	if err != nil {
		return err
	}

	_, err = redisClient.RPush(ctx, fmt.Sprintf("%s:items", boxKey), itemID).Result()
	if err != nil {
		return err
	}

	return nil
}

func RegisterHandler(w http.ResponseWriter, r *http.Request) {
	var creds Credentials
	if err := json.NewDecoder(r.Body).Decode(&creds); err != nil {
		http.Error(w, "Invalid input format. Please check your data and try again.", http.StatusBadRequest)
		return
	}

	ctx := context.Background()
	err := Register(ctx, &creds)
	if err != nil {
		var statusCode int
		var errorMessage string

		switch err.Error() {
		case "username already taken":
			statusCode = http.StatusConflict
			errorMessage = "The username you entered is already taken. Please choose a different one."
		case "email already in use":
			statusCode = http.StatusConflict
			errorMessage = "The email address you entered is already in use. Please use a different email."
		default:
			statusCode = http.StatusInternalServerError
			errorMessage = "An unexpected error occurred during registration. Please try again later."
		}

		http.Error(w, errorMessage, statusCode)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Registration successful. You can now log in with your new account."})
}

func LoginHandler(w http.ResponseWriter, r *http.Request) {
	var creds Credentials
	if err := json.NewDecoder(r.Body).Decode(&creds); err != nil {
		http.Error(w, "Invalid input format. Please check your data and try again.", http.StatusBadRequest)
		return
	}

	ctx := context.Background()
	token, err := Login(ctx, &creds)
	if err != nil {
		var statusCode int
		var errorMessage string

		switch err.Error() {
		case "user not found":
			statusCode = http.StatusNotFound
			errorMessage = "No account found with the provided email address. Please check your email and try again."
		case "incorrect password":
			statusCode = http.StatusUnauthorized
			errorMessage = "The password you entered is incorrect. Please try again."
		default:
			statusCode = http.StatusInternalServerError
			errorMessage = "An unexpected error occurred during login. Please try again later."
		}

		http.Error(w, errorMessage, statusCode)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"token": token, "message": "Login successful. Welcome back!"})
}

func CreateBoxHandler(w http.ResponseWriter, r *http.Request) {
	var box Box
	if err := json.NewDecoder(r.Body).Decode(&box); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	token := r.Header.Get("Authorization")
	if token == "" {
		http.Error(w, "Authorization header is required", http.StatusUnauthorized)
		return
	}

	token = token[len("Bearer "):]

	ctx := context.Background()
	qrCodeURL, err := CreateBox(ctx, token, box)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{"qr_code_url": qrCodeURL})
}

func AddItemHandler(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(10 << 20); err != nil {
		log.Printf("Error parsing multipart form: %v", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	boxID := r.FormValue("box_id")
	if boxID == "" {
		log.Println("box_id is missing")
		http.Error(w, "box_id is required", http.StatusBadRequest)
		return
	}

	quality, err := strconv.Atoi(r.FormValue("quality"))
	if err != nil || quality < 1 || quality > 10 {
		log.Printf("Invalid quality value: %v", err)
		http.Error(w, "quality must be between 1 and 10", http.StatusBadRequest)
		return
	}

	quantity, err := strconv.Atoi(r.FormValue("quantity"))
	if err != nil || quantity < 1 {
		log.Printf("Invalid quantity value: %v", err)
		http.Error(w, "quantity must be a positive integer", http.StatusBadRequest)
		return
	}

	item := Item{
		Name:        r.FormValue("name"),
		Description: r.FormValue("description"),
		Quality:     quality,
		Quantity:    quantity,
	}

	file, _, err := r.FormFile("image")
	if err != nil {
		log.Printf("Error getting form file: %v", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	token := r.Header.Get("Authorization")
	if token == "" {
		log.Println("Authorization header is missing")
		http.Error(w, "Authorization header is required", http.StatusUnauthorized)
		return
	}

	token = token[len("Bearer "):]

	ctx := context.Background()

	err = AddItem(ctx, token, boxID, item, file)
	if err != nil {
		log.Printf("Error adding item: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	defer file.Close()
	w.WriteHeader(http.StatusOK)
}

func GetBoxesHandler(w http.ResponseWriter, r *http.Request) {
	token := r.Header.Get("Authorization")
	if token == "" {
		http.Error(w, "Authorization header is required", http.StatusUnauthorized)
		return
	}

	token = token[len("Bearer "):]

	ctx := context.Background()

	boxes, err := GetBoxes(ctx, token)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(boxes)
}

func GetBoxByID(ctx context.Context, tokenString string, boxID string) (map[string]interface{}, error) {
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		return jwtKey, nil
	})

	if err != nil || !token.Valid {
		return nil, fmt.Errorf("unauthorized")
	}

	boxKey := fmt.Sprintf("box:%s:%s", claims.Username, boxID)

	exists, err := redisClient.Exists(ctx, boxKey).Result()
	if err != nil {
		return nil, err
	}
	if exists == 0 {
		return nil, fmt.Errorf("box not found")
	}

	box, err := redisClient.HGetAll(ctx, boxKey).Result()
	if err != nil {
		return nil, err
	}

	itemKeys, err := redisClient.LRange(ctx, fmt.Sprintf("%s:items", boxKey), 0, -1).Result()
	if err != nil {
		return nil, err
	}

	var items []map[string]interface{}
	for _, itemKey := range itemKeys {
		item, err := redisClient.HGetAll(ctx, itemKey).Result()
		if err != nil {
			return nil, err
		}

		quality, _ := strconv.Atoi(item["quality"])
		quantity, _ := strconv.Atoi(item["quantity"])

		itemWithDetails := map[string]interface{}{
			"name":        item["name"],
			"description": item["description"],
			"image_url":   item["image_url"],
			"quality":     quality,
			"quantity":    quantity,
		}

		items = append(items, itemWithDetails)
	}

	boxWithItems := make(map[string]interface{})
	for k, v := range box {
		boxWithItems[k] = v
	}
	boxWithItems["items"] = items

	return boxWithItems, nil
}

func GetBoxByIDHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	boxID := vars["id"]

	if boxID == "" {
		http.Error(w, "Box ID is required", http.StatusBadRequest)
		return
	}

	token := r.Header.Get("Authorization")
	if token == "" {
		http.Error(w, "Authorization header is required", http.StatusUnauthorized)
		return
	}

	token = token[len("Bearer "):]

	ctx := context.Background()

	box, err := GetBoxByID(ctx, token, boxID)
	if err != nil {
		if err.Error() == "box not found" {
			http.Error(w, err.Error(), http.StatusNotFound)
		} else if err.Error() == "unauthorized" {
			http.Error(w, err.Error(), http.StatusUnauthorized)
		} else {
			http.Error(w, err.Error(), http.StatusInternalServerError)
		}
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(box)
}

func DeleteBox(ctx context.Context, tokenString string, boxID string) error {
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		return jwtKey, nil
	})

	if err != nil || !token.Valid {
		return fmt.Errorf("unauthorized")
	}

	boxKey := fmt.Sprintf("box:%s:%s", claims.Username, boxID)

	exists, err := redisClient.Exists(ctx, boxKey).Result()
	if err != nil {
		return err
	}
	if exists == 0 {
		return fmt.Errorf("box not found")
	}

	itemKeys, err := redisClient.LRange(ctx, fmt.Sprintf("%s:items", boxKey), 0, -1).Result()
	if err != nil {
		return err
	}

	for _, itemKey := range itemKeys {
		_, err := redisClient.Del(ctx, itemKey).Result()
		if err != nil {
			return err
		}
	}

	_, err = redisClient.Del(ctx, boxKey).Result()
	if err != nil {
		return err
	}

	return nil
}
func DeleteBoxHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	boxID := vars["id"]

	if boxID == "" {
		http.Error(w, "Box ID is required", http.StatusBadRequest)
		return
	}

	token := r.Header.Get("Authorization")
	if token == "" {
		http.Error(w, "Authorization header is required", http.StatusUnauthorized)
		return
	}

	token = token[len("Bearer "):]

	ctx := context.Background()

	err := DeleteBox(ctx, token, boxID)
	if err != nil {
		if err.Error() == "box not found" {
			http.Error(w, err.Error(), http.StatusNotFound)
		} else if err.Error() == "unauthorized" {
			http.Error(w, err.Error(), http.StatusUnauthorized)
		} else {
			http.Error(w, err.Error(), http.StatusInternalServerError)
		}
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Box deleted successfully"})
}

func UpdateItem(ctx context.Context, tokenString string, boxID string, itemID string, updatedItem Item) error {
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		return jwtKey, nil
	})

	if err != nil || !token.Valid {
		return fmt.Errorf("unauthorized")
	}

	boxKey := fmt.Sprintf("box:%s:%s", claims.Username, boxID)
	itemKey := fmt.Sprintf("item:%s:%s", boxID, itemID)

	exists, err := redisClient.Exists(ctx, boxKey).Result()
	if err != nil {
		return err
	}
	if exists == 0 {
		return fmt.Errorf("box not found")
	}

	exists, err = redisClient.Exists(ctx, itemKey).Result()
	if err != nil {
		return err
	}
	if exists == 0 {
		return fmt.Errorf("item not found")
	}

	_, err = redisClient.HSet(ctx, itemKey, map[string]interface{}{
		"name":        updatedItem.Name,
		"description": updatedItem.Description,
		"quality":     updatedItem.Quality,
		"quantity":    updatedItem.Quantity,
	}).Result()

	if err != nil {
		return err
	}

	return nil
}
func UpdateItemHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	boxID := vars["boxId"]
	itemID := vars["itemId"]

	if boxID == "" || itemID == "" {
		http.Error(w, "Box ID and Item ID are required", http.StatusBadRequest)
		return
	}

	var updatedItem Item
	if err := json.NewDecoder(r.Body).Decode(&updatedItem); err != nil {
		http.Error(w, "Invalid input format", http.StatusBadRequest)
		return
	}

	token := r.Header.Get("Authorization")
	if token == "" {
		http.Error(w, "Authorization header is required", http.StatusUnauthorized)
		return
	}

	token = token[len("Bearer "):]

	ctx := context.Background()

	err := UpdateItem(ctx, token, boxID, itemID, updatedItem)
	if err != nil {
		switch err.Error() {
		case "unauthorized":
			http.Error(w, err.Error(), http.StatusUnauthorized)
		case "box not found":
			http.Error(w, err.Error(), http.StatusNotFound)
		case "item not found":
			http.Error(w, err.Error(), http.StatusNotFound)
		default:
			http.Error(w, err.Error(), http.StatusInternalServerError)
		}
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Item updated successfully"})
}

func main() {
	r := mux.NewRouter()
	r.HandleFunc("/register", RegisterHandler).Methods("POST")
	r.HandleFunc("/login", LoginHandler).Methods("POST")
	r.HandleFunc("/create-box", CreateBoxHandler).Methods("POST")
	r.HandleFunc("/add-item", AddItemHandler).Methods("POST")
	r.HandleFunc("/get-boxes", GetBoxesHandler).Methods("GET")
	r.HandleFunc("/box/{id}", GetBoxByIDHandler).Methods("GET")
	r.HandleFunc("/box/{id}", DeleteBoxHandler).Methods("DELETE")
	r.HandleFunc("/box/{boxId}/item/{itemId}", UpdateItemHandler).Methods("PUT")
	http.Handle("/", r)
	log.Fatal(http.ListenAndServe(":8080", nil))
}

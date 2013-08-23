EmberTwitterClient::Application.routes.draw do
  get 'auth/twitter/callback', to: 'sessions#create'
  resource :session
  get 'home' => 'home#index'
  root  to:   'home#index'
end

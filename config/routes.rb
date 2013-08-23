EmberTwitterClient::Application.routes.draw do
  get 'auth/twitter/callback', to: 'sessions#create'

  resource :session
  resource :user
  resources :timelines do
    get :home, on: :collection
  end

  root  to:   'home#index'
end

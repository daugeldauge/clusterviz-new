require 'open3'
require 'json'
require 'sinatra'
require 'sinatra/contrib'
require 'timeout'

configure do
  #raise 'Compilation error' unless system 'make -C src/'
  #set :show_exceptions => false
end

def error_page msg
  erb :error, :locals => {:msg => msg}
end

get '/' do
  clusters = %w(cheb lom lab)
  dot_info = {}
  clusters.each do |cluster|
    file = cluster + '.dot'
    stat = File.stat file
    info = '<strong>Last updated:</strong> ' + stat.ctime.strftime('%d.%m.%Y %H:%M:%S') + '<br>'
    info += '<strong>Size:</strong> ' + '%.2f' % [stat.size.to_f / (1024 * 1024)] + ' MiB<br>'
    #info += "IP: 0.0.0.0"
    dot_info[cluster.to_sym] = info
  end
  erb :start
end

get '/json' do
  headers 'Content-Type' => 'application\json'
  {
    name: 'hello',
    children: [
      {name: 'n1', size: 10000},
      {name: 'n2', size: 20000},
      {name: 'n3', size: 10000},
      {name: 'n4', size: 10000},
      {name: 'n5', size: 30000},
      {name: 'n6', size: 10000},
      {name: 'n7', size: 10000},
    ]
  }.to_json
end
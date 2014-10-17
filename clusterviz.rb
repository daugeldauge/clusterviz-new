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
    nodes:[
      {
        id: 'n1',
        label: 'node 1',
        size: 3,
        x: 0,
        y: 0
      },
      {
        id: 'n2',
        label: 'node 2',
        size: 2,
        x: 1,
        y: 0
       },
      {
        id: 'n3',
        label: 'node 3',
        size: 1,
        x: 1,
        y: 1
      },
    ],
    edges:[
      {
        id: 'e1',
        source: 'n1',
        target: 'n2'
      },
      {
        id: 'e2',
        source: 'n1',
        target: 'n3'
      },
      {
        id: 'e3',
        source: 'n2',
        target: 'n3'
      },
    ]
  }.to_json
end